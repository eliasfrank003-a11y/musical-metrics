import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Trash2, Palette } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

const Settings = () => {
  const { toast } = useToast();
  const [isClearing, setIsClearing] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [showPasscodeInput, setShowPasscodeInput] = useState(false);

  const handleClearData = async () => {
    if (!showPasscodeInput) {
      setShowPasscodeInput(true);
      return;
    }

    if (!passcode.trim()) {
      toast({
        title: 'Passcode required',
        description: 'Please enter the passcode to delete data',
        variant: 'destructive'
      });
      return;
    }

    setIsClearing(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-all-sessions', {
        body: { passcode: passcode.trim() },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Data cleared',
        description: 'All practice sessions have been deleted.'
      });
      
      setPasscode('');
      setShowPasscodeInput(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to clear data',
        variant: 'destructive'
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Settings</h1>
              <p className="text-xs text-muted-foreground">Manage your data and preferences</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Appearance Section */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Appearance
          </h2>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Theme</CardTitle>
              <CardDescription>
                Choose between light and dark mode
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ThemeToggle />
            </CardContent>
          </Card>
        </section>


        {/* Danger Zone Section */}
        <section>
          <div className="space-y-4">

            {/* Danger Zone */}
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="w-5 h-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription>
                  Permanently delete all your practice data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {showPasscodeInput && (
                  <Input
                    type="password"
                    placeholder="Enter passcode"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="max-w-xs"
                  />
                )}
                <div className="flex gap-2">
                  <Button 
                    variant="destructive" 
                    onClick={handleClearData}
                    disabled={isClearing}
                  >
                    {isClearing ? 'Clearing...' : showPasscodeInput ? 'Confirm Delete' : 'Clear All Data'}
                  </Button>
                  {showPasscodeInput && (
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setShowPasscodeInput(false);
                        setPasscode('');
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Settings;
