# E-invoice golden fixtures

Six JSON cases drive mapper, validator, and golden XML under `expected/`.

## Regenerate XML

```bash
UPDATE_EINVOICE_SAMPLES=1 npx vitest run helpers/einvoice/__tests__/samples.spec.js
```

## Regenerate `derived` blocks (after invoice/settings edits)

```bash
SYNC_EINVOICE_FIXTURES=1 npx vitest run helpers/einvoice/__tests__/syncFixtures.spec.js
```

## Offline validation (pinned artifacts)

Download from the official GitHub releases linked below. Verify SHA-256 before use.

| Tool | Version | SHA-256 |
|------|---------|---------|
| KoSIT validator | [validator-1.6.3-standalone.jar](https://github.com/itplr-kosit/validator/releases/tag/v1.6.3) | `799e64befca97d4080e03608c80b85dd5a5ecc5f4ae4f35d1116ec2855b9a7c9` |
| XRechnung config | [xrechnung-3.0.2-validator-configuration-2026-08-31.zip](https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/tag/v2026-08-31) | verify after unzip |
| Mustang CLI | [Mustang-CLI-2.26.0.jar](https://github.com/ZUGFeRD/mustangproject/releases/tag/core-2.26.0) | `42d7868cb68264874a7b8cab4c3587b03b23ccc7cd72373da917f66758bb9736` |

Use Java 17+ for validators (Java 11 is not sufficient). Example:

`~/manta-validators/jdk-17.0.21+9/Contents/Home/bin/java`

### KoSIT (XRechnung UBL)

```bash
cd ~/manta-validators
~/manta-validators/jdk-17.0.21+9/Contents/Home/bin/java -jar validator-1.6.3-standalone.jar \
  -s xr-config/scenarios.xml -r xr-config -h \
  /path/to/repo/e2e/fixtures/einvoice/expected/*.xrechnung.xml
echo "exit=$?"
```

### Mustang (CII XML)

```bash
REPO=/path/to/repo
for f in "$REPO"/e2e/fixtures/einvoice/expected/*.cii.xml; do
  ~/manta-validators/jdk-17.0.21+9/Contents/Home/bin/java -Xmx1G -Dfile.encoding=UTF-8 \
    -jar ~/manta-validators/Mustang-CLI-2.26.0.jar --no-notices --action validate --source "$f"
  echo "mustang_exit=$?"
done
```

Do not pipe validator output through `grep` or `tail`; check each command exit code directly.
