# 🛡️ Secure DAST Lab (Open Source Edition)

> *"Segurança não deve ser um segredo, mas sim um padrão compartilhado."*

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)
![OWASP ZAP](https://img.shields.io/badge/security-OWASP_ZAP-green.svg)

## 🤝 Sobre o Projeto

Criei este projeto **"Secure DAST Lab"** com um objetivo simples: **democratizar o acesso a testes de intrusão (Pentest) em ambientes de desenvolvimento.**

Muitas vezes, deixamos a segurança para o final da esteira de CI/CD ou para auditorias caras. Este laboratório foi desenhado para que você, desenvolvedor ou sysadmin, possa rodar scanners de vulnerabilidade poderosos (OWASP ZAP) na sua própria máquina, **antes** do seu código ir para produção.

Sinta-se à vontade para usar, estudar, modificar e, principalmente, **compartilhar** de volta com a comunidade!

---

## 🚀 O que este Lab faz?

Este ambiente containerizado sobe um dashboard local onde você pode apontar para qualquer aplicação (ou usar o container Nginx seguro incluso) e disparar ataques controlados para achar falhas.

### Suíte de Ferramentas Integradas:

| Componente | Tecnologia | Propósito no Lab |
| :--- | :--- | :--- |
| **Painel de Controle** | **Node.js Dashboard** | Uma interface gráfica simples para orquestrar os testes sem decorar linhas de comando. |
| **Scanner Passivo** | **OWASP ZAP (Baseline)** | Rápido (1-3 min). Verifica configurações HTTP, SSL e erros visíveis sem atacar o alvo. |
| **Scanner Ofensivo** | **OWASP ZAP (Full Attack)** | Profundo (10m+). Usa **AJAX Spider** (navegador real) e tenta injeções (SQLi, XSS) ativamente. |
| **Alvo de Teste** | **Nginx Hardened** | Um servidor web configurado com as melhores práticas (HSTS, CSP) para você usar de referência. |

---

## 🏗️ Arquitetura do Lab

Tudo roda isolado via Docker. O Dashboard comanda o container do ZAP, que por sua vez audita o alvo.

```mermaid
graph TD
    User((Você / Dev)) -->|Acessa Dashboard| Dash[🖥️ Security Dashboard]
    
    subgraph "Docker Security Lab"
        Dash -->|Comanda| ZAP[⚡ OWASP ZAP Scanner]
        ZAP -->|1. Spider (Crawl)| Target[🎯 Aplicação Alvo]
        ZAP -->|2. Attack (DAST)| Target
        
        Target -.->|Responde| ZAP
    end
    
    ZAP -->|Gera HTML/JSON| Report[📄 Relatórios de Vulnerabilidade]
    Report -->|Visualiza| Dash
```

---

## 🛠️ Como Subir o Lab (Quick Start)

Você só precisa do **Docker** e **Docker Compose** instalados.

1. Clone este repositório:
   ```bash
   git clone https://github.com/seu-usuario/secure-dast-lab.git
   cd secure-dast-lab
   ```

2. Suba o ambiente:
   ```bash
   docker compose up -d --build
   ```

3. Acesse o Dashboard:
   👉 **http://localhost:8088**

---

## 🛡️ Guia de Uso: Escolha sua Arma

No Dashboard, você verá duas opções principais de Scan. Entenda quando usar cada uma:

### 🔵 1. Baseline Scan (O "Check-up")
*   **Quando usar:** A cada commit ou PR.
*   **O que faz:** Navega pelo site passivamente. Verifica se você esqueceu Headers de segurança, cookies inseguros ou deixou vazar informações.
*   **Tempo:** Muito rápido.

### 🔴 2. Full Attack Scan (A "Simulação de Guerra")
*   **Quando usar:** Antes de releases importantes ou semanalmente.
*   **O que faz:**
    *   **AJAX Spider:** Abre um navegador Chrome headless, clica em botões, preenche formulários e executa JS (ideal para React/Vue/Angular).
    *   **Active Scan:** Tenta "hackear" seus inputs com SQL Injection, XSS, Path Traversal, etc.
    *   **Regras Alpha:** Ativa detecções experimentais da comunidade.
*   **Tempo:** Pode levar de 10 minutos a horas, dependendo do tamanho do site.

---

## 🤝 Como Contribuir

Este é um projeto Open Source! Se você tem ideias de como melhorar os scripts de scan, deixar o dashboard mais bonito ou adicionar novas ferramentas:

1.  Faça um **Fork** do projeto.
2.  Crie uma Branch para sua feature (`git checkout -b feature/nova-ferramenta`).
3.  Commit suas mudanças.
4.  Abra um **Pull Request**.

Vamos construir uma base de conhecimento de segurança acessível juntos!

---

## 📄 Licença

Distribuído sob a licença **MIT**. Você é livre para usar em projetos comerciais, pessoais ou educacionais.

---

*Feito com ❤️ e café por um Analista de Sistemas que acredita em Software Seguro.*
