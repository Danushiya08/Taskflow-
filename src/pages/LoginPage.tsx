import { useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Briefcase } from "lucide-react";
import { toast } from "sonner";

interface LoginPageProps {
  onLogin: (user: any) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerRole, setRegisterRole] = useState("team-member");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loginEmail.trim() || !loginPassword.trim()) {
      toast.error("Please enter email and password");
      return;
    }

    try {
      const res = await api.post("/auth/login", {
        email: loginEmail.trim(),
        password: loginPassword,
      });

      const token = res.data?.token;
      const user = res.data?.user;

      if (!token || !user) {
        toast.error("Login response is missing token or user");
        console.error("Login response:", res.data);
        return;
      }

      toast.success(res.data?.message || "Login successful");
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      onLogin(user);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        (err?.response?.status === 401 ? "Invalid email or password" : null) ||
        "Login failed. Please try again.";

      toast.error(msg);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await api.post("/auth/register", {
        name: registerName,
        email: registerEmail,
        password: registerPassword,
        role: registerRole,
      });

      toast.success(res.data?.message || "Registration successful");

      const loginRes = await api.post("/auth/login", {
        email: registerEmail.trim(),
        password: registerPassword,
      });

      const token = loginRes.data?.token;
      const user = loginRes.data?.user;

      if (!token || !user) {
        toast.error("Auto-login response is missing token or user");
        console.error("Auto-login response:", loginRes.data);
        return;
      }

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      onLogin(user);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Registration failed");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-8 items-center">
        <div className="text-center md:text-left space-y-6">
          <div className="flex items-center justify-center md:justify-start gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-3 rounded-xl">
              <Briefcase className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl text-gray-900">TaskFlow</h1>
          </div>

          <h2 className="text-3xl text-gray-900">
            Project Management,
            <br />
            Simplified & Intelligent
          </h2>

          <p className="text-gray-600">
            Manage projects, track time, collaborate in real-time, and leverage AI-driven insights to keep your team productive.
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-gray-900">AI-Powered Task Management</h4>
                <p className="text-sm text-gray-600">
                  Smart predictions for delays, workload balancing, and automated reports
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-gray-900">Real-Time Collaboration</h4>
                <p className="text-sm text-gray-600">
                  Live chat, video conferencing, and collaborative document editing
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-gray-900">Advanced Analytics</h4>
                <p className="text-sm text-gray-600">
                  Comprehensive reports, burndown charts, and project health indicators
                </p>
              </div>
            </div>
          </div>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Welcome to TaskFlow</CardTitle>
            <CardDescription>Login or create an account to get started</CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    Login
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Full Name</Label>
                    <Input
                      id="register-name"
                      type="text"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <Input
                      id="register-password"
                      type="password"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-role">Role</Label>
                    <select
                      id="register-role"
                      className="w-full rounded-md border border-gray-300 p-2"
                      value={registerRole}
                      onChange={(e) => setRegisterRole(e.target.value)}
                    >
                      <option value="admin">Admin</option>
                      <option value="project-manager">Project Manager</option>
                      <option value="team-member">Team Member</option>
                      <option value="client">Client (Read-Only)</option>
                    </select>
                  </div>

                  <Button type="submit" className="w-full">
                    Create Account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}