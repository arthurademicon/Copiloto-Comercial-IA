# Guia de Configuração VPS & Integração Evolution API

## Copiloto Comercial IA (v0.0.6) — Documento Operacional para o Agente Hermes

Este guia foi elaborado especificamente para o agente **Hermes** (executando diretamente na VPS com privilégios administrativos / root) para provisionar a infraestrutura de suporte ao **Copiloto Comercial IA**, especialmente o serviço de mensageria WhatsApp via **Evolution API v2** com TLS/HTTPS, webhook idempotente e automação de containers.

---

## 1. Visão Geral da Arquitetura

```
+-------------------------------------------------------------+
|                      VPS (Hermes)                           |
|                                                             |
|   +-----------------------------------------------------+   |
|   | Reverse Proxy (Caddy ou Nginx com Certbot / Let's Encrypt)
|   | Porta 80 / 443 (HTTPS Obrigatório)                  |
|   +--------------------------+--------------------------+   |
|                              |                              |
|                              v                              |
|   +-----------------------------------------------------+   |
|   | Evolution API (Docker Container: evolution-api)     |   |
|   | Porta interna: 8080 (não expor diretamente)         |   |
|   | API_KEY global configurada via ambiente             |   |
|   +-----------------------------------------------------+   |
|                              |                              |
|                              v                              |
|   +-----------------------------------------------------+   |
|   | Redis (opcional/recomendado para cache e sessões)   |   |
|   +-----------------------------------------------------+   |
+-------------------------------------------------------------+
       ^                                              |
       | Webhook (POST HTTPS)                         | Envio de mensagens /
       |                                              | Consulta de QR Code
       v                                              v
+-------------------------------------------------------------+
| Backend Copiloto Comercial IA (Skip Cloud / PocketBase)     |
| URL Pública:                                                |
| https://copiloto-comercial-ia-259d8.shrd00.internal.goskip.dev
+-------------------------------------------------------------+
```

---

## 2. Requisitos de Rede e Segurança

1. **HTTPS / TLS Obrigatório:**
   - A Evolution API **NUNCA** deve ser exposta publicamente em HTTP puro (sem TLS).
   - Utilize um domínio ou subdomínio válido com certificado TLS (Let's Encrypt gerenciado automaticamente via Caddy ou Nginx + Certbot).
   - Exemplo de URL pública estável: `https://evolution.seudominio.com` ou `https://evo-vps.seudominio.com`.

2. **Comunicação Bidirecional:**
   - A Evolution API na VPS deve conseguir alcançar e disparar requisições HTTP POST para o endpoint do backend:  
     `https://copiloto-comercial-ia-259d8.shrd00.internal.goskip.dev`
   - O backend do Copiloto deve conseguir alcançar a URL da Evolution API (`https://evolution.seudominio.com/instance/...`).
   - Portas 80 e 443 abertas no firewall da VPS (UFW / Security Group).

3. **Política de Reinício dos Containers:**
   - Todos os containers Docker devem rodar com política `restart: always` ou `restart: unless-stopped`.

---

## 3. Instalação da Evolution API via Docker Compose

### 3.1. Estrutura de Diretórios na VPS

Crie um diretório dedicado para a Evolution API:

```bash
mkdir -p /opt/evolution-api
cd /opt/evolution-api
```

### 3.2. Arquivo `docker-compose.yml`

Gere o arquivo `docker-compose.yml` com a configuração oficial recomendada da Evolution API v2:

```yaml
version: '3.8'

services:
  evolution-api:
    image: atendai/evolution-api:v2.2.3
    container_name: evolution-api
    restart: always
    environment:
      - SERVER_TYPE=http
      - SERVER_PORT=8080
      - SERVER_URL=https://evolution.seudominio.com
      - AUTHENTICATION_API_KEY=SUA_CHAVE_GLOBAL_SECRETA_MUITO_FORTE_AQUI
      - LOG_LEVEL=ERROR,WARN,INFO
      - STORE_MESSAGES=true
      - STORE_MESSAGE_UP=true
      - STORE_CONTACTS=true
      - STORE_CHATS=true
      - CLEAN_STORE_CLEANING_INTERVAL=7200
      - CLEAN_STORE_MESSAGES=true
      - CLEAN_STORE_MESSAGE_UP=true
      - CLEAN_STORE_CONTACTS=true
      - CLEAN_STORE_CHATS=true
      - QRCODE_LIMIT=30
      - REDIS_ENABLED=true
      - REDIS_URI=redis://evolution-redis:6379/1
    volumes:
      - evolution_instances:/evolution/instances
    networks:
      - evolution-net
    depends_on:
      - evolution-redis

  evolution-redis:
    image: redis:7.2-alpine
    container_name: evolution-redis
    restart: always
    command: ['redis-server', '--appendonly', 'yes']
    volumes:
      - redis_data:/data
    networks:
      - evolution-net

networks:
  evolution-net:
    name: evolution-net
    driver: bridge

volumes:
  evolution_instances:
  redis_data:
```

> **IMPORTANTE PARA O HERMES:**  
> Substitua `SUA_CHAVE_GLOBAL_SECRETA_MUITO_FORTE_AQUI` por um token aleatório e longo (mínimo de 32 caracteres hex/alphanumeric, gerado por exemplo com `openssl rand -hex 24`).  
> Substitua `https://evolution.seudominio.com` pelo domínio real que você apontará via DNS para a VPS.  
> **NUNCA comite ou versione senhas ou chaves de API em repositórios públicos.**

---

## 4. Configuração do Reverse Proxy com TLS Automático

### Opção A: Caddy (Recomendado pela simplicidade e SSL automático)

Se utilizar Caddy, crie `/etc/caddy/Caddyfile`:

```caddyfile
evolution.seudominio.com {
    reverse_proxy localhost:8080 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

Aplique com:

```bash
systemctl reload caddy
```

### Opção B: Nginx + Certbot

Se utilizar Nginx, crie `/etc/nginx/sites-available/evolution`:

```nginx
server {
    server_name evolution.seudominio.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
}
```

Ative e gere o certificado:

```bash
ln -s /etc/nginx/sites-available/evolution /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d evolution.seudominio.com
```

---

## 5. Webhook da Instância Evolution API

O backend do Copiloto Comercial IA possui uma rota de ingestão de mensagens e eventos desenhada especificamente para a Evolution API.

### 5.1. URL do Endpoint

```
POST https://copiloto-comercial-ia-259d8.shrd00.internal.goskip.dev/backend/v1/webhook/evolution
```

### 5.2. Eventos Obrigatórios

Configure a instância na Evolution para disparar **exatamente** os seguintes eventos para o webhook acima:

1. `MESSAGES_UPSERT` (recebimento e atualização de mensagens do WhatsApp)
2. `CONNECTION_UPDATE` (atualização do estado de pareamento: `open`, `connecting`, `close`)

### 5.3. Configuração do Webhook via API da Evolution

Ao criar ou atualizar a instância via cURL na VPS:

```bash
curl -X POST https://evolution.seudominio.com/webhook/set/copiloto-ademicon \
  -H "apikey: SUA_CHAVE_GLOBAL_SECRETA_MUITO_FORTE_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "url": "https://copiloto-comercial-ia-259d8.shrd00.internal.goskip.dev/backend/v1/webhook/evolution",
    "webhook_by_events": false,
    "events": [
      "MESSAGES_UPSERT",
      "CONNECTION_UPDATE"
    ]
  }'
```

---

## 6. Credenciais que o Backend Espera

Para que a aplicação conecte na Evolution API, informe as credenciais no painel do sistema:

- Acesse o sistema como usuário/consultor.
- Vá para **Configurações** (`/configuracoes?tab=conexoes`) → Seção **"Parâmetros da Evolution API (VPS Privada)"**.
- Preencha:
  - **URL Base Evolution:** `https://evolution.seudominio.com` (sem barra no final)
  - **Evolution API Key:** `SUA_CHAVE_GLOBAL_SECRETA_MUITO_FORTE_AQUI`
  - **Nome da Instância:** ex.: `copiloto-ademicon`
  - Clique em **"Salvar Conexão Evolution"**.

> Opcionalmente, essas variáveis também podem ser lidas a partir de variáveis de ambiente do backend PocketBase (`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`) via tabela `integration_configs`.

---

## 7. Passos de Validação Ponta a Ponta

Siga este checklist sequencial para atestar o funcionamento:

1. **Validar saúde da Evolution API na VPS:**

   ```bash
   curl -I https://evolution.seudominio.com
   # Deve retornar HTTP 200 ou 404/401 com JSON da Evolution
   ```

2. **Criar a Instância (caso ainda não criada via app):**

   ```bash
   curl -X POST https://evolution.seudominio.com/instance/create \
     -H "apikey: SUA_CHAVE_GLOBAL_SECRETA_MUITO_FORTE_AQUI" \
     -H "Content-Type: application/json" \
     -d '{
       "instanceName": "copiloto-ademicon",
       "token": "copiloto-ademicon-token",
       "qrcode": true,
       "integration": "WHATSAPP-BAILEYS"
     }'
   ```

3. **Conectar Instância (QR Code Real):**
   - Acesse **Configurações → Conexões & Integrações** na interface web do Copiloto.
   - O QR Code real gerado pela Evolution API será renderizado na tela.
   - Abra o WhatsApp no smartphone comercial → _Aparelhos conectados_ → _Conectar um aparelho_ e escaneie o QR Code.
   - O webhook `CONNECTION_UPDATE` disparará automaticamente com `state: "open"`, alterando o badge para **"WhatsApp Conectado"** em tempo real.

4. **Validar Ingestão Idempotente via Webhook:**
   - Envie uma mensagem de teste de um WhatsApp externo para o número pareado.
   - Verifique se a conversa e o lead aparecem na aba **Conversas** (`/conversas`).
   - Se a Evolution reenviar o mesmo payload, o backend reconhece o `provider_event_id` ou o id da mensagem e ignora a duplicação sem gerar erro.
   - Se o lead responder a uma campanha de Prospeção ou Disparo em Massa, o Copiloto atualiza o status para `respondido` e calcula as taxas de conversão automaticamente.

5. **Validar Envio Outbound:**
   - Na tela de **Conversas**, selecione a sugestão comercial gerada pela IA ou digite uma mensagem e clique em **Enviar**.
   - O backend invoca a rota de envio da Evolution (`/message/sendText/{instance}`) e a mensagem é entregue no WhatsApp do destinatário.

---

## 8. Nota Arquitetural sobre o n8n (Opcional)

Se houver necessidade de utilizar o **n8n** na mesma VPS:

- **Instalação:** Pode ser instalado via Docker Compose rodando em porta própria (ex.: 5678) atrás do mesmo reverse proxy (ex.: `https://n8n.seudominio.com`).
- **Não é pré-requisito:** O Copiloto Comercial IA possui todo o motor de regras de negócio, prospecção ativa, follow-ups cadenciados, scoring comercial, broadcast e integração com LLMs nativamente integrados em seu backend PocketBase e hooks JavaScript.
- **Princípio fundamental de arquitetura:**  
  _Nenhum estado crítico do sistema comercial (leads, pipeline, propostas, agendamentos, histórico de conversas) deve depender exclusivamente da memória ou execução transitória de nós do n8n._  
  O n8n deve ser utilizado estritamente como orquestrador auxiliar ou disparador de webhooks adicionais externos (ex.: CRM legado, ERP ou webhooks de terceiros).

---

## 9. Comandos Úteis de Diagnóstico na VPS (para Hermes)

```bash
# Ver logs em tempo real da Evolution API
docker logs -f --tail 100 evolution-api

# Reiniciar serviço da Evolution
docker restart evolution-api

# Verificar se a porta 8080 está escutando localmente
ss -tulpn | grep 8080

# Testar resolução DNS e alcance ao backend do Copiloto
curl -I https://copiloto-comercial-ia-259d8.shrd00.internal.goskip.dev/api/health
```

---

_Documento gerado para a versão 0.0.6 do Copiloto Comercial IA._
