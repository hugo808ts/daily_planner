# Agenda — documento de design

Data: 28/10/2026 · Status: aguardando aprovação · Nome provisório: **Agenda**

Rascunhos visuais aprovados na conversa: Hoje (direção B "Folha do dia"), captura com confirmação, placar e resumo semanal, Ideias e layout de computador. As cópias ficam em `docs/superpowers/mockups/`. **Onde um rascunho e este documento divergirem, vale este documento**, porque as decisões finais vieram depois dos rascunhos. Exemplos: o resumo sai no domingo e cobre seg–sáb (o rascunho mostra segunda e seg–dom); ideia resolvida é apagada (o rascunho mostra uma aba "Resolvidas").

## 1. Intenção

Um app pessoal, em português do Brasil, para **organizar a semana e o dia a dia**. O uso principal é abrir no iPhone ao acordar e ver o que está programado para hoje, anotar coisas rapidamente ao longo do dia (texto ou voz) e guardar ideias num "segundo cérebro" simples, organizado em pastas.

O motivo é ter um lugar só para a cabeça do dia a dia, separado do Google Agenda, que continua guardando datas distantes (provas etc.). O projeto também serve de repertório: precisa ficar bem feito, mas é de uma pessoa só.

## 2. Objetivos, não objetivos e antiobjetivos

**Objetivos**
- Tela **Hoje** que mostra as tarefas do dia, com a semana numa faixa para trocar de dia.
- **Captura rápida** por texto ou áudio, entendida por IA, sempre com confirmação editável antes de salvar.
- **Placar** simples: feitas, atrasadas e não feitas, mais um **resumo semanal no domingo**.
- **Ideias** em pastas criadas pelo usuário, com título, texto e um link, sem data.
- Mesmo app no **iPhone** (instalável na tela inicial) e no **computador** (layout amplo).
- Hospedado na Cloudflare, **24h no ar, custo zero**.

**Não objetivos (fora desta versão)**
- Notificações ou lembretes.
- Integração com o Google Agenda.
- Kanban/projetos (o Quadro não entra).
- Funcionar offline.
- Mais de um usuário, compartilhamento ou permissões.
- Tarefas recorrentes e hábitos.
- Pontos, níveis, medalhas e sequências.

**Antiobjetivos (seria um fracasso mesmo funcionando)**
- **Gerar qualquer custo.** Nunca usar recurso pago; se um limite gratuito estourar, o app degrada (ex.: cai nas regras), não cobra.
- **Cobrar o usuário.** Não feito é só registro: nada de insistir, perguntar ou empurrar tarefas sozinho.
- **Salvar algo errado sem o usuário ver.** Toda interpretação da IA passa pela confirmação.
- **Perder texto.** O editor de ideias salva sozinho.
- **Ficar acessível a estranhos.** O app só abre depois do login.

## 3. Restrições

- **iPhone 15 com Safari/PWA** é o alvo principal; o computador vem logo em seguida (Chrome/Edge).
- **Plano gratuito da Cloudflare:** Workers (100 mil requisições/dia, 10 ms de CPU por requisição), D1 (5 milhões de leituras e 100 mil escritas por dia, 500 MB por banco), Workers AI (10.000 neurônios/dia) e Access (login).
- **Fuso:** America/Sao_Paulo. Datas de tarefa são dias de calendário (`AAAA-MM-DD`), sem conversão de fuso.
- O usuário ainda **não tem conta na Cloudflare**; criar a conta e fazer login são passos dele.

## 4. Abordagens consideradas

A plataforma e a IA foram escolhidas na conversa. O que sobra são detalhes de implementação, e para eles só há um caminho sensato:

| Decisão | Alternativas | Escolha e por quê |
|---|---|---|
| Hospedagem | Vercel + Turso; Supabase; Cloudflare | **Cloudflare (escolha do usuário).** Tudo numa conta só, SQLite, não "dorme"; o Supabase pausa após uma semana sem uso. |
| Interpretação das mensagens | Só regras; IA da Cloudflare + regras; Gemini grátis | **IA da Cloudflare com regras de reserva (escolha do usuário).** Entende frase livre a custo zero; as regras seguram se a IA falhar. O Gemini foi descartado por exigir outra conta e porque o plano gratuito pode usar os dados. |
| Áudio | Reconhecimento de voz do navegador; Whisper na Cloudflare | **Whisper na Cloudflare (minha escolha).** O reconhecimento do Safari é instável no iPhone, principalmente com o app instalado. |
| Frontend | Next.js; React + Vite; outro | **React + Vite + Tailwind (minha escolha).** É a base que já funcionou no Quadro, roda como arquivos estáticos no Worker e dispensa servidor de renderização. |
| Backend | Pages Functions; Worker com arquivos estáticos | **Um único Worker** servindo a interface e a API (`/api/*`), com roteador Hono. É o formato que a Cloudflare recomenda hoje: um deploy só. |

## 5. O que o usuário decidiu

### 5.1 Hoje (celular)
- No topo, **faixa da semana** (seg a dom), com o dia atual destacado. Cada dia mostra pontinhos: roxo para feita, vermelho para não feita/atrasada, cinza para pendente. Tocar num dia mostra aquele dia.
- Título "Hoje" (ou o nome do dia, quando é outro), **placar** ("3 feitas · 2 atrasadas") e uma barra com um segmento por tarefa.
- **Lista** em estilo caderno, com checkbox para riscar. Cada tarefa mostra título, etiqueta de área e horário (se houver).
- **Anotação fixada** do dia (ex.: "📌 Levar o carregador").
- **Barra de captura** fixa embaixo, com campo de texto e microfone.
- Navegação em duas abas embaixo: **Hoje** e **Ideias**.

### 5.2 Tarefas
- Campos: título, dia, horário (opcional) e área (opcional).
- **Áreas:** etiqueta simples, identificada pela IA: 💼 Trabalho, 📚 Faculdade ou ❤️ Pessoal. Sem certeza, a tarefa fica sem etiqueta. A área serve só para identificar: não separa a lista em blocos nem filtra telas.
- **Estados**
  - *Pendente*.
  - *Feita*: em qualquer momento, inclusive depois do horário, conta como **feita normal**, sem marca de atraso.
  - *Atrasada*: tem horário, o horário passou e não foi marcada. Fica **vermelha**; se depois for marcada, vira feita normal.
  - *Não feita*: o dia terminou sem marcar. Fica registrada no dia dela.
- **Nada muda de dia sozinho.** Existe uma ação **opcional e discreta** para levar a tarefa a outro dia, com duas regras (*decisão minha*, para manter o histórico honesto):
  - **Ainda não virou não feita** (o dia não acabou): a tarefa só muda de data e não conta como não feita.
  - **Já é não feita** (dia passado, ou "levar para a semana nova" no resumo): a original **continua registrada como não feita** no dia dela, e uma **cópia nova** é criada no dia escolhido, com a marca "veio de <dia>" (`moved_from_id`). Assim, semanas passadas nunca mudam depois de fechadas.
- Editar e excluir uma tarefa são permitidos.

### 5.3 Captura rápida
1. O usuário escreve em linguagem natural ou segura o microfone e fala.
2. A IA devolve: tipo (**tarefa** ou **ideia**), título limpo, dia, horário, área (tarefas) ou pasta sugerida entre as **pastas existentes** (ideias).
3. Uma **folha de confirmação** mostra o texto original e os campos interpretados, cada um tocável para editar. "Salvar" grava; "Editar" abre o formulário completo.
- A confirmação aparece **sempre**.
- **Cada mensagem vira um item só** (decisão do usuário). Se a mensagem tiver duas coisas ("comprar pão e ligar pro João"), vira um item com esse título, e o usuário corrige se quiser. Uma coisa por mensagem.

### 5.4 Placar e resumo semanal
- A semana do placar vai de **segunda a sábado**. Tarefas de domingo aparecem no dia, mas não entram na conta.
- No **domingo**, ao abrir o app, um cartão "Sua semana fechou" leva ao resumo:
  - feitas, não feitas e % do planejado;
  - barras por dia (roxo e vermelho);
  - lista das não feitas, cada uma com o botão opcional de levar para a semana nova.
- O resumo fica acessível até o domingo seguinte. Semanas anteriores ficam consultáveis, calculadas a partir das tarefas.

### 5.5 Ideias
- **Tela inicial:** vazia ("Crie sua primeira pasta"); nenhuma pasta vem pronta.
- **Pastas:** criadas pelo usuário, com nome e emoji opcional; um nível só, sem subpastas. Dá para renomear e excluir (excluir pede confirmação e apaga as ideias dentro).
- **Toda ideia mora numa pasta** (*decisão minha*). Na confirmação da captura, o campo "Pasta" lista as pastas existentes e tem "+ Nova pasta" ali mesmo. Se ainda não existir nenhuma, a confirmação pede para criar a primeira antes de guardar. Não há caixa "sem pasta".
- **Ideia:** título, texto livre e **um link** principal. Sem data. Links extras vão no texto e viram clicáveis.
- **Prévia do link:** para TikTok e YouTube, mostrar capa e título quando o site oferecer; senão, mostrar o link simples.
- **Fixar** uma ideia no topo da pasta; o resto vai do mais recente para o mais antigo.
- **Resolvida = apagar de vez:**
  1. o botão abre a confirmação "Concluir e apagar esta ideia?";
  2. confirmando, a ideia some;
  3. um aviso "Ideia apagada · Desfazer" fica alguns segundos na tela;
  4. passado esse tempo, ela é apagada do banco.

  Não existe aba de resolvidas.
- **Virar tarefa:** cria uma tarefa a partir da ideia, passando pela mesma confirmação da captura (dia, horário, área). A ideia continua existindo até ser resolvida.
- **Busca** em todas as pastas (título e texto).

### 5.6 Computador
- Mesmo uso, tela maior. **Hoje fixo à esquerda**; o resto da tela é das **Ideias**, em três colunas: pastas, lista e editor.
- O editor ganha espaço para textos longos e **salva sozinho**.
- **Ctrl+K** abre a captura.

### 5.7 Acesso
- Login pelo **Cloudflare Access**, com código de uso único enviado ao e-mail do usuário. Só esse e-mail é liberado.
- **Sessão longa** (*decisão minha*): 1 mês, o máximo que o Access permite, para não pedir código toda hora no celular.
- **Arquivos públicos** (*decisão minha*): manifest e ícones do app ficam liberados (regra Bypass), porque o iPhone os busca sem cookie ao instalar na tela inicial. Não contêm dados; tudo o mais, inclusive a página e `/api/*`, exige login.
- **Risco conhecido:** o login do Access dentro do app instalado no iPhone é um ponto frágil (redirecionamento e cookies separados). A **primeira fase da construção valida isso no iPhone real**, com uma página mínima publicada. Se falhar, a alternativa é usar pelo Safari normal (com atalho na tela inicial), sem afrouxar o login.

## 6. Arquitetura (proposta para o construtor)

**Repositório:** `C:\Users\hugov\OneDrive\Desktop\MVPs\agenda`, com git.

```
src/        React (interface)
worker/     Worker: rotas /api/*, D1, Workers AI
migrations/ SQL do D1
wrangler.jsonc
```

**Um Worker** com arquivos estáticos (o build do Vite) e rotas `/api/*` em Hono. Bindings: `DB` (D1) e `AI` (Workers AI).

**Banco (D1)**
- `tasks`: id, title, date (`AAAA-MM-DD`), time (`HH:MM` ou nulo), area (`work`/`school`/`personal` ou nulo), done_at (nulo = não feita), moved_from_id (nulo, ou a tarefa não feita que originou esta cópia), created_at, updated_at.
- `day_notes`: date (chave), text. É a anotação fixada do dia.
- `folders`: id, name, emoji, created_at.
- `ideas`: id, folder_id (exclusão em cascata), title, body, link_url, link_title, link_thumb, pinned, created_at, updated_at.

Estados derivados (não gravados): *atrasada* = tem horário, `agora > date+time` (fuso de São Paulo) e `done_at` nulo; *não feita* = `date < hoje` e `done_at` nulo.

**API**
- `GET /api/week?start=AAAA-MM-DD`: tarefas e anotações da semana.
- CRUD `/api/tasks`, `PUT /api/day-notes/:date`.
- CRUD `/api/folders` e `/api/ideas`; `GET /api/ideas/search?q=`.
- `POST /api/capture {text}`: interpretação. Chama o Workers AI (modelo pequeno de instrução, ex.: Llama 3.x 8B rápido ou 3.2 3B) pedindo **saída JSON** e enviando a data de hoje, o dia da semana e os nomes das pastas. Valida a resposta; se a IA falhar, cair nas regras.
- `POST /api/transcribe` (áudio): Whisper (`whisper-large-v3-turbo`), português, até 60 s.
- `GET /api/report?week=AAAA-MM-DD`: resumo calculado.
- Ao salvar uma ideia com link, o servidor busca o oEmbed (TikTok/YouTube) e grava o título e a capa.

**Regras de reserva (sem IA):** datas em português ("hoje", "amanhã", "depois de amanhã", dias da semana, "dia 12", "às 14h", "14:30", "de manhã/à tarde/à noite"); área por palavras-chave (trabalho, faculdade, prova, aula…); "ideia:" no início força ideia.

**Segurança:** Access na frente de tudo; o Worker também valida o token do Access (`Cf-Access-Jwt-Assertion`). Mutações aceitas só da mesma origem; entradas validadas no servidor; tamanho máximo de corpo e de áudio.

**Celular / PWA:** manifest, ícone para a tela inicial do iPhone, modo standalone, áreas seguras (entalhe e barra inferior), sem zoom ao focar campos (fonte ≥ 16 px), alvos de toque ≥ 44 px. Seguir a skill `mobile-native`.

**Visual:** tokens dos rascunhos: fundo lilás claro `#F3F1FA`, tinta `#24203A`, violeta `#6D4AFF`, vermelho `#E5484D`, anotação `#FFF6C9`. Fontes Bricolage Grotesque e Geist, empacotadas localmente. Modo escuro com o sistema.

**Ambientes:** desenvolvimento local com `wrangler dev` e D1 local, com o Access desligado só nesse modo; produção em `agenda.<subdomínio>.workers.dev`.

## 7. Deixado para o construtor
- Escolha exata do modelo de IA e do prompt, dentro da cota gratuita; medir o consumo de neurônios por captura.
- Biblioteca de datas para as regras (`chrono-node` em pt ou parser próprio), conforme os testes.
- Detalhes de animação e transição; estados de carregamento e erro.
- Estrutura interna de componentes e testes (unitários para regras, datas e resumo; Playwright para os fluxos).
- Duração exata do "Desfazer" (sugestão: 5 s).

## 8. Passos que dependem do usuário
1. Criar a conta gratuita na Cloudflare.
2. Rodar `npx wrangler login` e autorizar no navegador.
3. No painel Zero Trust, criar a organização (plano Free) e confirmar o e-mail de login (com guia passo a passo).
4. No iPhone, abrir o endereço no Safari → Compartilhar → "Adicionar à Tela de Início".
