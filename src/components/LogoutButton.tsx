"use client";

import { Button } from "@heroui/react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <Button 
      size="sm" 
      variant="light" 
      color="danger" 
      startContent={<LogOut className="w-4 h-4" />}
      onClick={handleLogout}
    >
      退出
    </Button>
  );
}
