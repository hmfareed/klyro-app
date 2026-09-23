import { runGit, getFileBlob } from "@/server/git/git-service";

export interface SecretFinding {
  path: string;
  rule: string;
  description: string;
  preview: string;
}

export interface SecretScanResult {
  hasWarnings: boolean;
  findings: SecretFinding[];
  totalFilesScanned: number;
}

const SENSITIVE_FILENAME_RULES: Array<{
  pattern: RegExp;
  rule: string;
  description: string;
}> = [
  {
    pattern: /^\.env(?:\.local|\.dev|\.development|\.prod|\.production|\.staging|\.test)?$/i,
    rule: "ENV_FILE",
    description: "Environment configuration file that often contains secrets or credentials",
  },
  {
    pattern: /^(?:id_rsa|id_dsa|id_ecdsa|id_ed25519)$/i,
    rule: "SSH_PRIVATE_KEY_FILE",
    description: "Private SSH key file",
  },
  {
    pattern: /\.(?:pem|key|pkcs12|pfx|p12)$/i,
    rule: "PRIVATE_KEY_CERT_FILE",
    description: "Cryptographic private key or certificate bundle",
  },
  {
    pattern: /^(?:credentials|client_secret|service[-_]account.*)\.json$/i,
    rule: "SERVICE_CREDENTIALS_JSON",
    description: "Service account or client credentials JSON file",
  },
];

const CONTENT_RULES: Array<{
  pattern: RegExp;
  rule: string;
  description: string;
  redact: (match: string) => string;
}> = [
  {
    pattern: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
    rule: "AWS_ACCESS_KEY",
    description: "Amazon Web Services (AWS) Access Key ID",
    redact: (m) => `${m.slice(0, 4)}••••••••••••${m.slice(-4)}`,
  },
  {
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
    rule: "PRIVATE_KEY_BLOCK",
    description: "Unencrypted Private Key header",
    redact: () => "-----BEGIN PRIVATE KEY----- [REDACTED]",
  },
  {
    pattern: /(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis):\/\/([^:\/\s]+):([^@\/\s]+)@([^\/\s]+)/gi,
    rule: "DATABASE_CONNECTION_URI",
    description: "Database connection URL containing username and password",
    redact: (m) => m.replace(/:\/\/[^:]+:[^@]+@/, "://[user]:••••••••@"),
  },
  {
    pattern: /sk-(?:proj-|live-)?[a-zA-Z0-9]{32,}/g,
    rule: "OPENAI_SECRET_KEY",
    description: "OpenAI API secret key",
    redact: (m) => `sk-••••••••${m.slice(-4)}`,
  },
  {
    pattern: /sk_live_[0-9a-zA-Z]{24,}/g,
    rule: "STRIPE_SECRET_KEY",
    description: "Stripe live secret key",
    redact: (m) => `sk_live_••••••••${m.slice(-4)}`,
  },
  {
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
    rule: "GITHUB_TOKEN",
    description: "GitHub personal access token or OAuth secret",
    redact: (m) => `${m.slice(0, 4)}••••••••${m.slice(-4)}`,
  },
];

/**
 * Scans a repository bare Git directory at the specified branch (default: main)
 * for sensitive files, API keys, credentials, and connection strings.
 */
export async function scanRepoForSecrets(
  gitStoragePath: string,
  ref = "main"
): Promise<SecretScanResult> {
  const findings: SecretFinding[] = [];
  let fileList: string[] = [];

  try {
    const { stdout } = await runGit(gitStoragePath, ["ls-tree", "-r", "--name-only", ref]);
    fileList = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (err: any) {
    // Repository may be empty or branch doesn't exist yet
    return { hasWarnings: false, findings: [], totalFilesScanned: 0 };
  }

  let scannedCount = 0;

  for (const filePath of fileList) {
    scannedCount++;
    const fileName = filePath.split("/").pop() || filePath;

    // 1. Check filename rules
    for (const rule of SENSITIVE_FILENAME_RULES) {
      if (rule.pattern.test(fileName)) {
        findings.push({
          path: filePath,
          rule: rule.rule,
          description: rule.description,
          preview: `Sensitive filename: ${fileName}`,
        });
      }
    }

    // 2. Check content for text files under 250 KB
    try {
      const blob = await getFileBlob(gitStoragePath, ref, filePath);
      if (blob.isBinary || blob.size > 250 * 1024) continue;

      const content = blob.content;
      for (const rule of CONTENT_RULES) {
        // Reset regex state if global
        rule.pattern.lastIndex = 0;
        const match = rule.pattern.exec(content);
        if (match) {
          findings.push({
            path: filePath,
            rule: rule.rule,
            description: rule.description,
            preview: rule.redact(match[0]),
          });
        }
      }
    } catch {}
  }

  return {
    hasWarnings: findings.length > 0,
    findings,
    totalFilesScanned: scannedCount,
  };
}
