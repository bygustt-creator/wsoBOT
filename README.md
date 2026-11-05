# Bot da Federação (JavaScript)

Free Agency, contratos e times, guiados por cargos.

## Como iniciar

1. Instale o Node.js 18 ou superior (https://nodejs.org).
2. Na pasta do projeto, instale as dependências:
   ```
   npm install
   ```
3. Renomeie `.env.example` para `.env` e informe o token do bot:
   ```
   DISCORD_TOKEN=seu_token
   ```
4. Inicie:
   ```
   npm start
   ```

## Configuração no servidor

1. `/painel` → **Contratos**: defina a capacidade, o canal de contratos, o cargo de manager e o cargo de assistente.
2. `/painel` → **Free Agency**: defina o canal que receberá os formulários.
3. `/addteam cargo emoji`: registre cada time.
4. Entregue ao manager o cargo de manager e o cargo do time.

O cargo do bot deve ficar **acima** dos cargos dos times e possuir a permissão **Gerenciar Cargos**.

## Comandos

| Comando | Quem usa | Função |
| --- | --- | --- |
| `/free-agency` | Todos | Abre o formulário de Free Agency |
| `/painel` | Administração | Painel de configurações |
| `/addteam` | Administração ou manager do time | Registra um time |
| `/removeteam` | Administração ou manager do time | Remove um time |
| `/contract` | Manager e assistente | Envia a proposta de contrato no privado |
| `/release` | Manager e assistente | Remove um jogador do time |

As configurações ficam salvas em `config.json`, criado automaticamente.
