import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

// Simple validation without zod to avoid compilation conflicts
const validateInput = (username: string, password: string) => {
  if (!username.trim()) {
    return { error: "Username không được để trống" };
  }
  if (username.length > 50) {
    return { error: "Username không được quá 50 ký tự" };
  }
  if (password.length < 6) {
    return { error: "Mật khẩu phải có ít nhất 6 ký tự" };
  }
  if (password.length > 100) {
    return { error: "Mật khẩu không được quá 100 ký tự" };
  }
  return { error: null };
};

export default function Auth() {
  const { user, signIn, signUp, loading } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '' });

  // Redirect if already authenticated
  if (user && !loading) {
    return <Navigate to="/" replace />;
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (action: 'signin' | 'signup') => {
    try {
      // Validate input
      const validation = validateInput(formData.username, formData.password);
      if (validation.error) {
        toast({
          title: "Lỗi nhập liệu",
          description: validation.error,
          variant: "destructive",
        });
        return;
      }

      setIsLoading(true);
      const { username, password } = formData;
      
      let error;
      if (action === 'signin') {
        ({ error } = await signIn(username, password));
      } else {
        ({ error } = await signUp(username, password));
      }

      if (error) {
        let errorMessage = "Đã xảy ra lỗi. Vui lòng thử lại.";
        
        if (error.message?.includes('Invalid login credentials')) {
          errorMessage = "Tên đăng nhập hoặc mật khẩu không đúng.";
        } else if (error.message?.includes('User already registered')) {
          errorMessage = "Tài khoản đã tồn tại. Vui lòng đăng nhập.";
        } else if (error.message?.includes('Password should be at least 6 characters')) {
          errorMessage = "Mật khẩu phải có ít nhất 6 ký tự.";
        }

        toast({
          title: action === 'signin' ? "Lỗi đăng nhập" : "Lỗi đăng ký",
          description: errorMessage,
          variant: "destructive",
        });
      } else if (action === 'signup') {
        toast({
          title: "Đăng ký thành công",
          description: "Tài khoản đã được tạo thành công!",
        });
      }
    } catch (err) {
      toast({
        title: "Lỗi hệ thống",
        description: "Đã xảy ra lỗi không mong muốn.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Hệ thống quản lý</CardTitle>
          <CardDescription>
            Đăng nhập với tài khoản của bạn
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Đăng nhập</TabsTrigger>
              <TabsTrigger value="signup">Đăng ký</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-username">Tên đăng nhập</Label>
                <div className="relative">
                  <Input
                    id="signin-username"
                    type="text"
                    placeholder="Nhập tên đăng nhập"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    className="pr-24"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
                    @internal.app
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signin-password">Mật khẩu</Label>
                <Input
                  id="signin-password"
                  type="password"
                  placeholder="Nhập mật khẩu"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                />
              </div>
              
              <Button 
                className="w-full" 
                onClick={() => handleSubmit('signin')}
                disabled={isLoading}
              >
                {isLoading ? "Đang đăng nhập..." : "Đăng nhập"}
              </Button>
            </TabsContent>
            
            <TabsContent value="signup" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-username">Tên đăng nhập</Label>
                <div className="relative">
                  <Input
                    id="signup-username"
                    type="text"
                    placeholder="Chọn tên đăng nhập"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    className="pr-24"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
                    @internal.app
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-password">Mật khẩu</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="Tạo mật khẩu (tối thiểu 6 ký tự)"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                />
              </div>
              
              <Button 
                className="w-full" 
                onClick={() => handleSubmit('signup')}
                disabled={isLoading}
              >
                {isLoading ? "Đang đăng ký..." : "Đăng ký"}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}