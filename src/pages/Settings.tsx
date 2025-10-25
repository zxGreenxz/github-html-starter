import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Key, Printer } from "lucide-react";
import { TPOSCredentialsManager } from "@/components/settings/TPOSCredentialsManager";
import { PrinterConfigManager } from "@/components/settings/PrinterConfigManager";
import { SystemDocumentation } from "@/components/settings/SystemDocumentation";

const Settings = () => {
  const isMobile = useIsMobile();
  const { toast } = useToast();

  return (
    <div className={cn("mx-auto space-y-6", isMobile ? "p-4" : "container p-6")}>
      <div className={cn("flex items-center", isMobile ? "flex-col items-start gap-3 w-full" : "justify-between")}>
        <div>
          <h1 className={cn("font-bold", isMobile ? "text-xl" : "text-3xl")}>Cài đặt</h1>
          <p className={cn("text-muted-foreground mt-2", isMobile ? "text-sm" : "text-base")}>
            Quản lý các cài đặt hệ thống
          </p>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full grid grid-cols-3 gap-1">
          <TabsTrigger value="general" className="gap-2">
            <Key className="h-4 w-4" />
            <span className={isMobile ? "hidden" : "inline"}>Cấu hình chung</span>
            <span className={isMobile ? "inline" : "hidden"}>Chung</span>
          </TabsTrigger>
          <TabsTrigger value="printer" className="gap-2">
            <Printer className="h-4 w-4" />
            <span className={isMobile ? "hidden" : "inline"}>Máy in</span>
            <span className={isMobile ? "inline" : "hidden"}>In</span>
          </TabsTrigger>
          <TabsTrigger value="documentation" className="gap-2">
            <span className={isMobile ? "hidden" : "inline"}>Tài liệu</span>
            <span className={isMobile ? "inline" : "hidden"}>Docs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-4">
          <TPOSCredentialsManager />
        </TabsContent>

        <TabsContent value="printer" className="space-y-6 mt-4">
          <PrinterConfigManager />
        </TabsContent>

        <TabsContent value="documentation" className="space-y-6 mt-4">
          <SystemDocumentation />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;