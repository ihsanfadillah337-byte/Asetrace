import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { z } from "zod";

// Validation schemas
const signUpSchema = z.object({
  fullName: z.string()
    .trim()
    .min(3, "Nama minimal 3 karakter")
    .max(100, "Nama maksimal 100 karakter"),
  nim: z.string()
    .trim()
    .min(5, "NIM minimal 5 karakter")
    .max(20, "NIM maksimal 20 karakter")
    .regex(/^[0-9]+$/, "NIM harus berupa angka"),
  programStudi: z.string()
    .trim()
    .min(2, "Program studi minimal 2 karakter")
    .max(100, "Program studi maksimal 100 karakter"),
  angkatan: z.number()
    .int("Angkatan harus berupa angka")
    .min(2000, "Angkatan minimal 2000")
    .max(new Date().getFullYear() + 1, "Angkatan tidak valid"),
  email: z.string()
    .trim()
    .email("Email tidak valid")
    .max(255, "Email maksimal 255 karakter"),
  password: z.string()
    .min(6, "Password minimal 6 karakter")
    .max(100, "Password maksimal 100 karakter"),
});

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [nim, setNim] = useState("");
  const [programStudi, setProgramStudi] = useState("");
  const [angkatan, setAngkatan] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, role, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user && role) {
      const dashboardMap = {
        admin: '/dashboard/admin',
        operator: '/dashboard/operator',
        user: '/dashboard/user',
      };
      navigate(dashboardMap[role], { replace: true });
    }
  }, [user, role, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.user.id)
          .single();

        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.user.id)
          .order('role', { ascending: true })
          .limit(1)
          .single();

        if (roleData) {
          await supabase.from('audit_logs').insert({
            user_id: data.user.id,
            user_name: profile?.full_name || data.user.email || 'Unknown User',
            user_role: roleData.role,
            action: 'login',
            details: {},
          });
        }
      }

      toast({
        title: "Welcome back!",
        description: "Successfully logged in to Asetrace.",
      });
      
      const { data: updatedRoleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user!.id)
        .single();
      
      const dashboardMap = {
        admin: '/dashboard/admin',
        operator: '/dashboard/operator',
        user: '/dashboard/user',
      };
      const userRole = updatedRoleData?.role as 'admin' | 'operator' | 'user' || 'user';
      navigate(dashboardMap[userRole], { replace: true });
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate inputs
      const validationResult = signUpSchema.safeParse({
        fullName,
        nim,
        programStudi,
        angkatan: parseInt(angkatan),
        email,
        password,
      });

      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        throw new Error(firstError.message);
      }

      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email: validationResult.data.email,
        password: validationResult.data.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: validationResult.data.fullName,
            nim: validationResult.data.nim,
            program_studi: validationResult.data.programStudi,
            angkatan: validationResult.data.angkatan,
          },
        },
      });

      if (error) throw error;

      // Profile, user_role, dan student record sudah otomatis dibuat oleh trigger
      toast({
        title: "Akun berhasil dibuat!",
        description: "Profile, role, dan data mahasiswa sudah terkonfigurasi. Silakan login.",
      });
      
      setIsSignUp(false);
      setFullName("");
      setNim("");
      setProgramStudi("");
      setAngkatan("");
    } catch (error: any) {
      toast({
        title: "Registrasi gagal",
        description: error.message || "Terjadi kesalahan. Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background blueprint-grid">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-primary/5 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-accent/5 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.5, 0.3, 0.5],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        
        {/* Floating tech elements */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-primary/20 rounded-full"
            style={{
              left: `${20 + i * 15}%`,
              top: `${10 + i * 12}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.6, 0.2],
            }}
            transition={{
              duration: 3 + i,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.4,
            }}
          />
        ))}
      </div>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md p-8 mx-4"
      >
        <div className="glass-panel rounded-xl shadow-card p-8 border-2 border-border/30 hover-lift">
          {/* Logo with glow effect */}
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-center gap-3 mb-3">
              <motion.div
                className="p-2 bg-primary/10 rounded-lg glow-effect"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <Zap className="w-8 h-8 text-primary" />
              </motion.div>
              <h1 className="text-4xl font-bold text-foreground tracking-tight">
                Asetrace
              </h1>
            </div>
            <p className="text-muted-foreground text-sm font-medium">
              Neo Blueprint Asset Management
            </p>
          </motion.div>

          {/* Auth Form */}
          <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
            {isSignUp && (
              <>
                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Label htmlFor="fullName" className="text-foreground font-medium">Nama Lengkap</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Masukkan nama lengkap"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={isLoading}
                    maxLength={100}
                    className="bg-background/50 border-border/50 focus:border-primary transition-smooth"
                  />
                </motion.div>

                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  <Label htmlFor="nim" className="text-foreground font-medium">NIM</Label>
                  <Input
                    id="nim"
                    type="text"
                    placeholder="Masukkan NIM"
                    value={nim}
                    onChange={(e) => setNim(e.target.value.replace(/\D/g, ''))}
                    required
                    disabled={isLoading}
                    maxLength={20}
                    className="bg-background/50 border-border/50 focus:border-primary transition-smooth"
                  />
                </motion.div>

                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <Label htmlFor="programStudi" className="text-foreground font-medium">Program Studi</Label>
                  <Input
                    id="programStudi"
                    type="text"
                    placeholder="Contoh: Teknik Informatika"
                    value={programStudi}
                    onChange={(e) => setProgramStudi(e.target.value)}
                    required
                    disabled={isLoading}
                    maxLength={100}
                    className="bg-background/50 border-border/50 focus:border-primary transition-smooth"
                  />
                </motion.div>

                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.45 }}
                >
                  <Label htmlFor="angkatan" className="text-foreground font-medium">Angkatan</Label>
                  <Input
                    id="angkatan"
                    type="number"
                    placeholder="Contoh: 2024"
                    value={angkatan}
                    onChange={(e) => setAngkatan(e.target.value)}
                    required
                    disabled={isLoading}
                    min={2000}
                    max={new Date().getFullYear() + 1}
                    className="bg-background/50 border-border/50 focus:border-primary transition-smooth"
                  />
                </motion.div>
              </>
            )}

            <motion.div
              className="space-y-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: isSignUp ? 0.5 : 0.3 }}
            >
              <Label htmlFor="email" className="text-foreground font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Masukkan email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                maxLength={255}
                className="bg-background/50 border-border/50 focus:border-primary transition-smooth"
              />
            </motion.div>

            <motion.div
              className="space-y-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: isSignUp ? 0.55 : 0.4 }}
            >
              <Label htmlFor="password" className="text-foreground font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={6}
                maxLength={100}
                className="bg-background/50 border-border/50 focus:border-primary transition-smooth"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: isSignUp ? 0.6 : 0.5 }}
            >
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-glow transition-smooth"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isSignUp ? "Mendaftar..." : "Masuk..."}
                  </>
                ) : (
                  isSignUp ? "Daftar" : "Masuk"
                )}
              </Button>
            </motion.div>

            <div className="text-center space-y-2">
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground transition-smooth"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setFullName("");
                  setNim("");
                  setProgramStudi("");
                  setAngkatan("");
                }}
              >
                {isSignUp ? "Sudah punya akun? " : "Belum punya akun? "}
                <span className="text-primary font-medium">
                  {isSignUp ? "Masuk" : "Daftar"}
                </span>
              </button>
              
              {!isSignUp && (
                <button
                  type="button"
                  className="block w-full text-sm text-primary hover:text-primary/80 font-medium transition-smooth"
                  onClick={() => {
                    toast({
                      title: "Reset Password",
                      description: "Fitur reset password akan segera hadir.",
                    });
                  }}
                >
                  Lupa Password?
                </button>
              )}
            </div>
          </form>

          {/* Demo credentials */}
          {!isSignUp && (
            <motion.div
              className="mt-6 p-4 bg-muted/30 rounded-lg border border-border/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <p className="text-xs font-semibold text-foreground text-center mb-2">
                Kredensial Demo
              </p>
              <p className="text-xs text-muted-foreground text-center">
                Login sebagai demo user:
              </p>
              <div className="text-xs text-foreground text-center mt-2 space-y-1">
                <p><strong className="text-primary">Email:</strong> ihsanbukanadmin@gmail.com</p>
                <p><strong className="text-primary">Password:</strong> ihsan123</p>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
