import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lock, User, Building2 } from 'lucide-react';
import logoImg from '@/assets/logo-cnt.png';

export default function Login() {
  const { signIn, user } = useAuth();
  const { schools, schoolId, setSchoolId } = useSchool();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<string>(schoolId ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedSchool) {
      setError('Selecione a unidade');
      return;
    }

    setLoading(true);

    // Save the selected school first so the app loads scoped data
    setSchoolId(selectedSchool);

    // If user is already authenticated, just selecting school is enough
    if (user) {
      setLoading(false);
      return;
    }

    // Auto-append domain if just a name is provided
    const loginEmail = email.includes('@') ? email : `${email.toLowerCase()}@cnt.com`;

    const { error: err } = await signIn(loginEmail, password);
    if (err) {
      setError('Usuário ou senha incorretos');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="bg-card border rounded-xl p-8 shadow-lg">
          <div className="text-center mb-6">
            <img src={logoImg} alt="CNT Informática" className="w-20 h-20 rounded-full mx-auto mb-1 object-cover" />
            <h1 className="text-2xl font-bold text-foreground">CNT Informática</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {user ? 'Selecione a unidade para continuar' : 'Faça login para acessar o sistema'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="school">Selecionar Unidade</Label>
              <div className="relative mt-1">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
                <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                  <SelectTrigger id="school" className="pl-9">
                    <SelectValue placeholder="Escolha uma unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!user && (
              <>
                <div>
                  <Label htmlFor="email">Usuário</Label>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      placeholder="Ex: elisa"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Sua senha"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : user ? 'Continuar' : 'Entrar'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
