import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";

interface Credential {
  id: string;
  name: string;
  username: string;
  token_type: 'tpos' | 'facebook';
  bearer_token?: string;
  created_at: string;
}

export function TPOSCredentialsManager() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  // Form state
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tokenType, setTokenType] = useState<'tpos' | 'facebook'>('tpos');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
    const { data, error } = await (supabase as any)
      .from('tpos_credentials')
      .select('id, name, username, token_type, bearer_token, created_at')
      .order('created_at', { ascending: false });

      if (error) throw error;
      setCredentials(data || []);
    } catch (error) {
      console.error('Error loading credentials:', error);
      toast({
        title: "Lỗi",
        description: "Không thể tải danh sách tài khoản",
        variant: "destructive",
      });
    }
  };

  const fetchTokenFromTPOS = async (username: string, password: string): Promise<string> => {
    const tokenResponse = await fetch('https://tomato.tpos.vn/token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Origin': 'https://tomato.tpos.vn',
        'Referer': 'https://tomato.tpos.vn/',
        'tposappversion': '5.10.13.1',
        'x-tpos-lang': 'vi'
      },
      body: new URLSearchParams({
        grant_type: 'password',
        username,
        password,
        client_id: 'tmtWebApp'
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Failed to get token:', tokenResponse.status, errorText);
      throw new Error(`Không thể lấy token: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      throw new Error('Không có access token trong response');
    }

    return tokenData.access_token;
  };

  const handleSave = async () => {
    if (!name.trim() || !username.trim() || !password.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ thông tin",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Fetch token from TPOS
      toast({
        title: "Đang xử lý",
        description: "Đang lấy token từ TPOS...",
      });

      const bearerToken = await fetchTokenFromTPOS(username.trim(), password.trim());

      // Save credentials with token
      const { error } = await (supabase as any)
        .from('tpos_credentials')
        .insert({
          name: name.trim(),
          username: username.trim(),
          password: password.trim(),
          token_type: tokenType,
          bearer_token: bearerToken,
        });

      if (error) throw error;

      toast({
        title: "Thành công",
        description: "Đã lưu tài khoản và token",
      });

      setName("");
      setUsername("");
      setPassword("");
      setTokenType('tpos');
      setShowForm(false);
      loadCredentials();
    } catch (error: any) {
      console.error('Error saving credential:', error);
      toast({
        title: "Lỗi",
        description: error.message || "Không thể lấy token. Kiểm tra username/password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa tài khoản này?")) return;

    try {
      const { error } = await (supabase as any)
        .from('tpos_credentials')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Thành công",
        description: "Đã xóa tài khoản",
      });

      loadCredentials();
    } catch (error) {
      console.error('Error deleting credential:', error);
      toast({
        title: "Lỗi",
        description: "Không thể xóa tài khoản",
        variant: "destructive",
      });
    }
  };

  const handleRefreshToken = async (credentialId: string) => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('refresh-tpos-token', {
        body: { credentialId }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Thành công",
          description: "Đã cập nhật token mới",
        });
      } else {
        throw new Error(data.message || 'Failed to refresh token');
      }
    } catch (error: any) {
      console.error('Error refreshing token:', error);
      toast({
        title: "Lỗi",
        description: error.message || "Không thể cập nhật token",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quản lý tài khoản TPOS</CardTitle>
        <CardDescription>
          Lưu tài khoản để tự động cập nhật token sau 7 ngày
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* List of saved credentials */}
        <div className="space-y-2">
          {credentials.map((cred) => (
            <div
              key={cred.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{cred.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {cred.token_type === 'tpos' ? 'TPOS Token' : 'Facebook Token'}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">{cred.username}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRefreshToken(cred.id)}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh Token
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(cred.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Add new credential form */}
        {!showForm ? (
          <Button onClick={() => setShowForm(true)} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Thêm tài khoản mới
          </Button>
        ) : (
          <div className="space-y-4 p-4 border rounded-lg">
            <div>
              <Label htmlFor="cred-name">Tên tài khoản</Label>
              <Input
                id="cred-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Tài khoản chính"
              />
            </div>
            <div>
              <Label htmlFor="cred-username">Username</Label>
              <Input
                id="cred-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username TPOS"
              />
            </div>
            <div>
              <Label htmlFor="cred-password">Password</Label>
              <Input
                id="cred-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password TPOS"
              />
            </div>
            <div>
              <Label htmlFor="token-type">Loại Token</Label>
              <Select value={tokenType} onValueChange={(value: 'tpos' | 'facebook') => setTokenType(value)}>
                <SelectTrigger id="token-type">
                  <SelectValue placeholder="Chọn loại token" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tpos">TPOS Bearer Token</SelectItem>
                  <SelectItem value="facebook">Facebook Bearer Token</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Token này sẽ được tự động cập nhật khi refresh
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={loading} className="flex-1">
                {loading ? "Đang lưu..." : "Lưu"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setName("");
                  setUsername("");
                  setPassword("");
                  setTokenType('tpos');
                }}
              >
                Hủy
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
