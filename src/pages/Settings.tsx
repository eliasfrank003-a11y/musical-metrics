import { CsvImporter } from '@/components/CsvImporter';
import { GoogleCalendarStatus } from '@/components/GoogleCalendarStatus';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Database, Trash2, Calendar, Palette } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isClearing, setIsClearing] = useState(false);

  const handleImportComplete = () => {
    toast({
      title: 'Data imported!',
      description: 'Return to dashboard to see your updated charts.'
    });
  };

  const handleClearData = async () => {
    if (!confirm('Are you sure you want to delete ALL practice sessions? This cannot be undone.')) {
      return;
    }

    setIsClearing(true);
    try {
      const { error } = await supabase
        .from('practice_sessions')
        .delete()
        .neq('id', 0); // Delete all rows

      if (error) throw error;

      toast({
        title: 'Data cleared',
        description: 'All practice sessions have been deleted.'
      });
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
    <div className="min-h-screen bg-background pt-[env(safe-area-inset-top)]">
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

        {/* Google Calendar Section */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Calendar Integration
          </h2>
          
          <GoogleCalendarStatus variant="full" />
        </section>

        {/* Data Management Section */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
            <Database className="w-4 h-4" />
            Data Management
          </h2>
          
          <div className="space-y-4">
            {/* CSV Importer */}
            <CsvImporter onImportComplete={handleImportComplete} />

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
              <CardContent>
                <Button 
                  variant="destructive" 
                  onClick={handleClearData}
                  disabled={isClearing}
                >
                  {isClearing ? 'Clearing...' : 'Clear All Data'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Settings;
