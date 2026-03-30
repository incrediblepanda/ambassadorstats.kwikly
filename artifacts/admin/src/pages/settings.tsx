import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGetSettings, useUpdateSettings, useTestConnection, useGetWebhookInfo, useRotateWebhookSecret } from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Save, Plug, Loader2, CheckCircle2, ShieldAlert, Lock, AlertCircle, Info, Terminal, Zap, Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";

const settingsSchema = z.object({
  getAmbassadorApiBaseUrl: z.string().optional().or(z.literal("")),
  getAmbassadorUsername: z.string().optional().or(z.literal("")),
  getAmbassadorApiToken: z.string().optional().or(z.literal("")),
  appBaseUrl: z.string().optional().or(z.literal("")),
  syncEnabled: z.boolean(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

function EnvLockedBadge() {
  return (
    <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-medium bg-blue-50 text-blue-700 border-blue-200 gap-1">
      <Lock className="w-2.5 h-2.5" /> Replit Secret
    </Badge>
  );
}

function CredentialRow({
  label,
  isSet,
  isFromEnv,
}: {
  label: string;
  isSet: boolean;
  isFromEnv: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-2">
        {isSet ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        ) : (
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
        )}
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {isFromEnv && <EnvLockedBadge />}
        <Badge
          variant="outline"
          className={
            isSet
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] h-5 px-1.5"
              : "bg-amber-50 text-amber-700 border-amber-200 text-[10px] h-5 px-1.5"
          }
        >
          {isSet ? "Configured" : "Not set"}
        </Badge>
      </div>
    </div>
  );
}

function ZapierWebhookCard() {
  const { data: webhookInfo, isLoading, refetch } = useGetWebhookInfo();
  const { mutateAsync: rotateSecret, isPending: isRotating } = useRotateWebhookSecret();
  const { toast } = useToast();
  const [secretVisible, setSecretVisible] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [attrEmail, setAttrEmail] = useState("");
  const [attrShortCode, setAttrShortCode] = useState("");
  const [attrLoading, setAttrLoading] = useState(false);
  const [attrResult, setAttrResult] = useState<{ matched: boolean; referrerName?: string; reason?: string } | null>(null);

  const copyText = async (text: string, which: "url" | "secret") => {
    await navigator.clipboard.writeText(text);
    if (which === "url") {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  const handleRotate = async () => {
    try {
      await rotateSecret();
      await refetch();
      setSecretVisible(false);
      toast({ title: "Secret Rotated", description: "Your old secret is now invalid. Update it in Zapier." });
    } catch {
      toast({ title: "Rotate Failed", description: "Could not rotate the secret.", variant: "destructive" });
    }
  };

  const handleManualAttribution = async () => {
    if (!attrEmail.trim() || !attrShortCode.trim()) return;
    setAttrLoading(true);
    setAttrResult(null);
    try {
      const resp = await fetch("/api/settings/manual-attribution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: attrEmail.trim(), shortCode: attrShortCode.trim() }),
      });
      const data = await resp.json();
      setAttrResult(data);
      if (data.matched) {
        toast({ title: "Attribution Applied", description: `Prospect linked to ${data.referrerName}.` });
      }
    } catch {
      toast({ title: "Error", description: "Could not run attribution.", variant: "destructive" });
    } finally {
      setAttrLoading(false);
    }
  };

  const maskedSecret = webhookInfo?.secret
    ? webhookInfo.secret.slice(0, 8) + "••••••••••••••••••••••••••••" + webhookInfo.secret.slice(-4)
    : "";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/10 border-b border-border/50 pb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#FF4A00]" />
            <div>
              <CardTitle className="text-lg font-display">Zapier Integration</CardTitle>
              <CardDescription>
                Receive lead attribution from HubSpot via Zapier webhooks.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-5">
          {isLoading ? (
            <div className="h-20 flex items-center justify-center text-muted-foreground animate-pulse text-sm">
              Loading webhook info...
            </div>
          ) : webhookInfo ? (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Webhook URL</label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={webhookInfo.webhookUrl}
                    className="font-mono text-xs bg-muted/30 text-muted-foreground"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 px-3"
                    onClick={() => copyText(webhookInfo.webhookUrl, "url")}
                  >
                    {copiedUrl ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Paste this URL into the Webhooks by Zapier POST action.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Secret Token</label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={secretVisible ? webhookInfo.secret : maskedSecret}
                    className="font-mono text-xs bg-muted/30 text-muted-foreground"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 px-3"
                    onClick={() => setSecretVisible((v) => !v)}
                  >
                    {secretVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 px-3"
                    onClick={() => copyText(webhookInfo.secret, "secret")}
                  >
                    {copiedSecret ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add this as the <code className="text-xs bg-muted px-1 py-0.5 rounded">X-Kwikly-Secret</code> header in your Zapier webhook.
                </p>
              </div>

              <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Zapier Setup Steps</p>
                <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside leading-relaxed">
                  <li><span className="font-medium text-foreground">Trigger:</span> HubSpot — Contact Recently Created or Updated</li>
                  <li><span className="font-medium text-foreground">Filter:</span> Only continue if <code className="bg-muted px-1 py-0.5 rounded">referring_shortcode</code> is not empty</li>
                  <li><span className="font-medium text-foreground">Action:</span> Webhooks by Zapier — POST to the URL above</li>
                  <li>Set header <code className="bg-muted px-1 py-0.5 rounded">X-Kwikly-Secret</code> to the secret token above</li>
                  <li>Map body fields: <code className="bg-muted px-1 py-0.5 rounded">email</code>, <code className="bg-muted px-1 py-0.5 rounded">referring_shortcode</code>, <code className="bg-muted px-1 py-0.5 rounded">firstName</code>, <code className="bg-muted px-1 py-0.5 rounded">lastName</code>, <code className="bg-muted px-1 py-0.5 rounded">jobTitle</code>, <code className="bg-muted px-1 py-0.5 rounded">shiftsWorked</code>, <code className="bg-muted px-1 py-0.5 rounded">approvedAt</code></li>
                </ol>
              </div>

              <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Manual Attribution / Backfill</p>
                <p className="text-xs text-muted-foreground">Manually link an existing prospect to an ambassador by email and short code. Useful for backfilling contacts that predate the Zap.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="Prospect email"
                    value={attrEmail}
                    onChange={(e) => { setAttrEmail(e.target.value); setAttrResult(null); }}
                    className="text-sm flex-1"
                  />
                  <Input
                    placeholder="Ambassador short code"
                    value={attrShortCode}
                    onChange={(e) => { setAttrShortCode(e.target.value); setAttrResult(null); }}
                    className="text-sm flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={handleManualAttribution}
                    disabled={attrLoading || !attrEmail.trim() || !attrShortCode.trim()}
                    className="shrink-0 bg-[#e84a67] hover:bg-[#c73a54] text-white"
                  >
                    {attrLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                  </Button>
                </div>
                {attrResult && (
                  <Alert className={attrResult.matched ? "border-emerald-500/50 bg-emerald-50/10" : "border-amber-500/50 bg-amber-50/10"}>
                    <AlertDescription className="text-xs">
                      {attrResult.matched
                        ? <><CheckCircle2 className="inline w-3.5 h-3.5 text-emerald-500 mr-1" />Prospect linked to <strong>{attrResult.referrerName}</strong>.</>
                        : <><AlertCircle className="inline w-3.5 h-3.5 text-amber-500 mr-1" />{attrResult.reason === "prospect_not_found" ? "No prospect found with that email." : attrResult.reason === "advocate_not_found" ? "No ambassador found with that short code." : "Attribution did not match."}</>
                      }
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Failed to load webhook info.</p>
          )}
        </CardContent>
        <CardFooter className="bg-muted/5 border-t border-border/50 py-3 justify-between items-center">
          <p className="text-xs text-muted-foreground">Rotate your secret if it has been compromised.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRotate}
            disabled={isRotating}
          >
            {isRotating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Rotate Secret
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const { mutateAsync: updateSettings, isPending: isSaving } = useUpdateSettings();
  const { mutateAsync: testConnection, isPending: isTesting } = useTestConnection();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [lastTestResult, setLastTestResult] = useState<{
    success: boolean;
    message: string;
    details?: Record<string, unknown>;
  } | null>(null);

  const envBaseUrlSet = settings?.envBaseUrlSet ?? false;
  const envUsernameSet = settings?.envUsernameSet ?? false;
  const envTokenSet = settings?.envTokenSet ?? false;
  const allApiCredsFromEnv = envBaseUrlSet && envUsernameSet && envTokenSet;

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      getAmbassadorApiBaseUrl: "",
      getAmbassadorUsername: "",
      getAmbassadorApiToken: "",
      appBaseUrl: "",
      syncEnabled: false,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        getAmbassadorApiBaseUrl: envBaseUrlSet ? "" : (settings.getAmbassadorApiBaseUrl || ""),
        getAmbassadorUsername: envUsernameSet ? "" : (settings.getAmbassadorUsername || ""),
        getAmbassadorApiToken: "",
        appBaseUrl: settings.appBaseUrl || "",
        syncEnabled: settings.syncEnabled,
      });
    }
  }, [settings, form, envBaseUrlSet, envUsernameSet]);

  const onSubmit = async (data: SettingsFormValues) => {
    try {
      const payload: typeof data = { ...data };
      if (!payload.getAmbassadorApiToken) {
        delete payload.getAmbassadorApiToken;
      }
      if (envBaseUrlSet) delete payload.getAmbassadorApiBaseUrl;
      if (envUsernameSet) delete payload.getAmbassadorUsername;

      await updateSettings({ data: payload });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });

      toast({
        title: "Settings Saved",
        description: "Your configuration has been updated.",
      });

      form.setValue("getAmbassadorApiToken", "");
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save settings.",
        variant: "destructive",
      });
    }
  };

  const handleTestConnection = async () => {
    setLastTestResult(null);
    try {
      const res = await testConnection();
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setLastTestResult({ success: res.success, message: res.message, details: res.details ?? undefined });
      if (res.success) {
        toast({
          title: "Connection Successful",
          description: res.message,
          className: "border-emerald-500 bg-emerald-50 text-emerald-900",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: res.message,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      const msg = err.message || "Could not verify API credentials.";
      setLastTestResult({ success: false, message: msg });
      toast({
        title: "Connection Failed",
        description: msg,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading settings...</div>;
  }

  const tokenSet = settings?.getAmbassadorApiTokenSet ?? false;
  const canTestConnection = tokenSet || !!form.watch("getAmbassadorApiToken");
  const connectionOk = settings?.connectionStatus === "connected";
  const lastSync = settings?.lastSyncAt ? new Date(settings.lastSyncAt) : null;

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Settings"
        description="Configure your GetAmbassador integration and application preferences."
      />

      {/* Status overview card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/10 border-b border-border/50 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-lg font-display">Integration Status</CardTitle>
                <CardDescription>Current state of the GetAmbassador API connection.</CardDescription>
              </div>
              {connectionOk ? (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 h-6">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 h-6">
                  <ShieldAlert className="w-3.5 h-3.5 mr-1.5" /> Not verified
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-0">
              <CredentialRow
                label="API Base URL"
                isSet={!!(settings?.getAmbassadorApiBaseUrl)}
                isFromEnv={envBaseUrlSet}
              />
              <CredentialRow
                label="API Username"
                isSet={!!(settings?.getAmbassadorUsername)}
                isFromEnv={envUsernameSet}
              />
              <CredentialRow
                label="API Token"
                isSet={tokenSet}
                isFromEnv={envTokenSet}
              />
            </div>
            {lastSync && (
              <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border/40">
                Last successful sync: <span className="font-medium text-foreground">{format(lastSync, "PPP 'at' p")}</span>
              </p>
            )}
          </CardContent>
          <CardFooter className="bg-muted/5 border-t border-border/50 py-3 flex-col items-start gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={isTesting || !canTestConnection}
            >
              {isTesting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plug className="w-4 h-4 mr-2" />
              )}
              Test Connection
            </Button>

            {lastTestResult && (
              <div className={`w-full rounded-lg border text-xs font-mono p-3 space-y-1 ${
                lastTestResult.success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-red-50 border-red-200 text-red-900"
              }`}>
                <div className="flex items-center gap-1.5 font-semibold text-[11px] uppercase tracking-wide mb-2">
                  <Terminal className="w-3 h-3" />
                  Connection Diagnostics
                </div>
                <div><span className="text-muted-foreground">Status:</span> {lastTestResult.success ? "✓ Connected" : "✗ Failed"}</div>
                <div><span className="text-muted-foreground">Message:</span> {lastTestResult.message}</div>
                {!!lastTestResult.details?.urlPattern && (
                  <div className="break-all"><span className="text-muted-foreground">URL:</span> {String(lastTestResult.details.urlPattern)}</div>
                )}
                {!!lastTestResult.details?.httpStatus && (
                  <div><span className="text-muted-foreground">HTTP Status:</span> {String(lastTestResult.details.httpStatus)}</div>
                )}
                {!!lastTestResult.details?.latencyMs && (
                  <div><span className="text-muted-foreground">Latency:</span> {String(lastTestResult.details.latencyMs)}ms</div>
                )}
                {!!lastTestResult.details?.responseSnippet && (
                  <div className="break-all mt-1 pt-1 border-t border-current/10">
                    <span className="text-muted-foreground">Response:</span> {String(lastTestResult.details.responseSnippet).slice(0, 200)}
                  </div>
                )}
              </div>
            )}
          </CardFooter>
        </Card>
      </motion.div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* API credentials */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
            <Card className="border-border/50 shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/10 border-b border-border/50 pb-4">
                <CardTitle className="text-lg font-display">GetAmbassador API Credentials</CardTitle>
                <CardDescription>
                  Credentials for server-side API syncing. Add them as{" "}
                  <span className="font-medium text-foreground">Replit Secrets</span> for the most secure setup.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {allApiCredsFromEnv && (
                  <Alert className="bg-blue-50 border-blue-200 text-blue-800">
                    <Lock className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-700">
                      All API credentials are loaded from Replit Secrets and cannot be overridden here.
                    </AlertDescription>
                  </Alert>
                )}

                <FormField
                  control={form.control}
                  name="getAmbassadorApiBaseUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        API Base URL
                        {envBaseUrlSet && <EnvLockedBadge />}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={
                            envBaseUrlSet
                              ? "Set via GETAMBASSADOR_API_BASE_URL secret"
                              : "https://api.getambassador.com/api/v2"
                          }
                          disabled={envBaseUrlSet}
                          className={envBaseUrlSet ? "bg-muted/50 text-muted-foreground" : "bg-muted/30"}
                          {...field}
                        />
                      </FormControl>
                      {!envBaseUrlSet && (
                        <FormDescription>
                          Include the full path e.g. <code className="text-xs bg-muted px-1 py-0.5 rounded">https://api.getambassador.com/api/v2</code>. Trailing slashes and auth segments are stripped automatically.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="getAmbassadorUsername"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          Username
                          {envUsernameSet && <EnvLockedBadge />}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={
                              envUsernameSet
                                ? "Set via GETAMBASSADOR_API_USERNAME secret"
                                : "company_username"
                            }
                            disabled={envUsernameSet}
                            className={envUsernameSet ? "bg-muted/50 text-muted-foreground" : "bg-muted/30"}
                            {...field}
                          />
                        </FormControl>
                        {!envUsernameSet && (
                          <FormDescription className="text-xs">
                            Or set <code className="text-xs bg-muted px-1 py-0.5 rounded">GETAMBASSADOR_API_USERNAME</code>
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="getAmbassadorApiToken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          API Token
                          {envTokenSet && <EnvLockedBadge />}
                          {!envTokenSet && tokenSet && (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-emerald-50 text-emerald-700 border-emerald-200">
                              Saved
                            </Badge>
                          )}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder={
                              envTokenSet
                                ? "Set via GETAMBASSADOR_API_TOKEN secret"
                                : tokenSet
                                  ? "Leave blank to keep existing token"
                                  : "Enter API token"
                            }
                            disabled={envTokenSet}
                            className={envTokenSet ? "bg-muted/50 text-muted-foreground" : "bg-muted/30"}
                            {...field}
                          />
                        </FormControl>
                        {!envTokenSet && (
                          <FormDescription className="text-xs">
                            Or set <code className="text-xs bg-muted px-1 py-0.5 rounded">GETAMBASSADOR_API_TOKEN</code>
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* System preferences */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <Card className="border-border/50 shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/10 border-b border-border/50 pb-4">
                <CardTitle className="text-lg font-display">System Preferences</CardTitle>
                <CardDescription>Configure core application behavior.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <FormField
                  control={form.control}
                  name="appBaseUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Public App Base URL
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://dashboards.mycompany.com"
                          className="bg-muted/30"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Used to generate ambassador iframe links. Format:{" "}
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          {"<base-url>/dashboard/<short-code>?token=<token>"}
                        </code>
                        . Or set <code className="text-xs bg-muted px-1 py-0.5 rounded">APP_BASE_URL</code> as a secret.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="syncEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/50 bg-muted/10 p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base font-semibold">Enable Background Sync</FormLabel>
                        <FormDescription>
                          Automatically poll GetAmbassador for new data on a schedule.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="data-[state=checked]:bg-primary"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </motion.div>

          {/* Secrets reference */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
            <Card className="border-border/50 shadow-sm overflow-hidden bg-muted/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <Info className="w-4 h-4 text-muted-foreground" />
                  Required Replit Secrets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  {[
                    { name: "SESSION_SECRET", set: null, required: true },
                    { name: "GETAMBASSADOR_API_BASE_URL", set: envBaseUrlSet, required: true },
                    { name: "GETAMBASSADOR_API_USERNAME", set: envUsernameSet, required: true },
                    { name: "GETAMBASSADOR_API_TOKEN", set: envTokenSet, required: true },
                    { name: "APP_BASE_URL", set: null, required: false },
                    { name: "ADMIN_BOOTSTRAP_EMAIL", set: null, required: false },
                    { name: "ADMIN_BOOTSTRAP_PASSWORD", set: null, required: false },
                  ].map(({ name, set, required }) => (
                    <div
                      key={name}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-background border border-border/50"
                    >
                      {set === true ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                      ) : set === false ? (
                        <div className={`w-2 h-2 rounded-full shrink-0 ${required ? "bg-amber-400" : "bg-muted-foreground/30"}`} />
                      ) : (
                        <div className="w-2 h-2 rounded-full shrink-0 bg-muted-foreground/30" />
                      )}
                      <span className={set === true ? "text-foreground" : "text-muted-foreground"}>{name}</span>
                      {!required && (
                        <span className="ml-auto text-[10px] text-muted-foreground">optional</span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Add secrets via the Replit "Secrets" panel (lock icon in the sidebar). API credentials set as secrets take priority over values saved here.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {!allApiCredsFromEnv && (
            <div className="flex justify-end pt-2 pb-12">
              <Button
                type="submit"
                size="lg"
                disabled={isSaving}
                className="shadow-lg shadow-primary/25 hover:shadow-xl px-8"
              >
                {isSaving ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Save className="w-5 h-5 mr-2" />
                )}
                Save Configuration
              </Button>
            </div>
          )}
        </form>
      </Form>

      <ZapierWebhookCard />
    </div>
  );
}
