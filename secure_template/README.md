# Secure Container Template

Uma solução integrada para implantação de servidores web seguros, com auditoria de segurança automatizada e painel de monitoramento.

Este projeto fornece um ambiente "pronto para uso" que combina as melhores práticas de configuração de servidor web (Nginx) com ferramentas de teste de penetração padrão da indústria (OWASP ZAP), orquestrados via Docker.

## 🚀 Tecnologias e Arquitetura

O projeto é composto por três serviços principais isolados em containers Docker:

### 1. Web Service (Nginx Hardened)

- **Container**: `web`
- **Tecnologia**: Nginx
- **Função**: Servidor web principal.
- **Segurança**:
  - **HTTPS Forçado**: Redirecionamento 301 de HTTP para HTTPS.
  - **Headers de Segurança**: HSTS, CSP, X-Frame-Options, X-Content-Type-Options configurados por padrão.
  - **Isolamento**: Roda em rede interna segregada.

### 2. Security Scanner (OWASP ZAP)

- **Container**: `zap` (security_scanner)
- **Tecnologia**: OWASP Zed Attack Proxy (ZAP)
- **Função**: Realizar varreduras de vulnerabilidade ativas `(DAST)` contra o servidor web.
- **Operação**: Integrado em modo containerizado para execuções programáticas.

### 3. Security Dashboard

- **Container**: `dashboard`
- **Tecnologia**: Node.js
- **Função**: Interface de gerenciamento e visualização.
  - Dispara varreduras de segurança no container `web`.
  - Visualiza os relatórios HTML gerados pelo ZAP.
  - Fornece API para controle das operações.

## 📋 Pré-requisitos

- Docker
- Docker Compose

## 🛠️ Instalação e Execução

1. **Clone o repositório** (se aplicável) ou navegue até a pasta do projeto.

2. **Inicie os serviços**:

   ```bash
   docker-compose up -d --build
   ```

   Isso irá construir as imagens e iniciar os containers em background.

3. **Acesse as aplicações**:
   - **Website Seguro**: [https://localhost:8443](https://localhost:8443) (ou `http://localhost:8085`)
   - **Dashboard de Segurança**: [http://localhost:8088](http://localhost:8088)

## 🛡️ Como Realizar Testes de Segurança

Você pode executar testes de vulnerabilidade de três formas:

### Via Dashboard (ZAP e CVE)

1. Acesse o Dashboard em [http://localhost:8088](http://localhost:8088).
2. Utilize os botões para iniciar um scan:
   - **Run/Rerun ZAP Scan**: Executa o teste de penetração ativa (ferramenta ZAP).
   - **Run CVE Scan**: Executa a verificação de versões e vulnerabilidades conhecidas (ferramenta Trivy).
   - **Run Secret Scan**: Analisa o código fonte em busca de segredos/chaves expostas (ferramenta TruffleHog).
3. Aguarde a finalização e clique para abrir o relatório correspondente.

### Via Linha de Comando (Manual)

Se preferir executar o scanner manualmente diretamente pelo Docker:

```bash
docker compose exec zap zap-baseline.py -t http://web:80 -r report.html
```

> **Nota**: O relatório `report.html` será salvo na pasta `reports/` e ficará visível instantaneamente no Dashboard.

## 🔍 Itens Verificados no Scan

O scanner de segurança (OWASP ZAP) realiza automaticamente mais de 50 verificações de segurança, incluindo:

### Proteção de Headers HTTP
- **Strict-Transport-Security (HSTS)**: Garante que a conexão seja sempre HTTPS.
- **Content-Security-Policy (CSP)**: Protege contra XSS e injeção de dados.
- **X-Frame-Options**: Previne ataques de Clickjacking.
- **X-Content-Type-Options**: Bloqueia MIME-sniffing incorreto.
- **Permissions-Policy**: Restringe acesso a recursos/APIs do navegador.

### Segurança de Cookies
- **HttpOnly Flag**: Protege cookies de acesso via JavaScript (mitigação de XSS).
- **Secure Flag**: Garante que cookies sejam transmitidos apenas via HTTPS.
- **SameSite Attribute**: Protege contra CSRF (Cross-Site Request Forgery).

### Prevenção de Ataques Web
- **Cross-Site Scripting (XSS)**: Verificações de injeção de scripts em inputs e headers.
- **CSRF Tokens**: Valida a presença de tokens anti-CSRF em formulários.
- **Information Leakage**: Busca por comentários suspeitos, mensagens de debug e exposições de IP privado.
- **Open Redirects**: Valida redirecionamentos para domínios externos não confiáveis.

### Configuração SSL/TLS
- **Mixed Content**: Garante que recursos não seguros (HTTP) não sejam carregados em páginas HTTPS.
- **Insecure Transitions**: Verifica redirecionamentos seguros entre HTTP e HTTPS.

### Vulnerabilidades de Infraestrutura (Trivy)
- **CVEs de Sistema Operacional**: Escaneia pacotes do sistema (Alpine/Debian) em busca de vulnerabilidades conhecidas.
- **Dependências de Aplicação**: Verifica bibliotecas (npm, pip, composer, etc.) em busca de versões vulneráveis.
- **Configurações Impróprias**: Checa se o container roda como root ou tem permissões excessivas.

### Segredos e Dados Sensíveis (TruffleHog)
- **Credenciais de Cloud**: Detecta chaves da AWS, GCP, Azure, etc.
- **Chaves Privadas**: Identifica chaves SSH, PGP e certificados privados.
- **Tokens de API**: Busca padrões de tokens Slack, GitHub, Stripe, e centenas de outros serviços.
- **Senhas Hardcoded**: Verifica strings que parecem senhas ou entropia suspeita no código fonte.

## 📂 Estrutura de Arquivos

```
.
├── docker-compose.yml    # Orquestração dos serviços
├── nginx.conf            # Configuração de segurança do Nginx
├── dashboard/            # Código fonte do painel de controle Node.js
│   ├── server.js         # Servidor backend do dashboard
│   └── public/           # Frontend do dashboard
└── reports/              # Volume compartilhado onde os relatórios do ZAP são salvos
```

## 🔒 Detalhes de Segurança Implementados

O `nginx.conf` incluído aplica automaticamente os seguintes controles:

- **Strict-Transport-Security (HSTS)**: Força navegadores a usarem HTTPS.
- **Content-Security-Policy (CSP)**: Previne XSS restringindo fontes de scripts/estilos.
- **X-Frame-Options**: Previne ataques de Clickjacking.
- **X-Content-Type-Options**: Previne MIME-sniffing.
