# Ideias de gamificação — Agenda (rascunho de conversa, 2026-11-13)

Status: **visual aprovado em 2026-11-13** (rascunhos 3 e 4: `heroi-2026-11.html` e `heroi-castelo-2026-11.html`). Ainda **sem plano de construção**: o próximo passo é um plano próprio (`make-plan`), depois de terminar a aba Treino.

## Decisões do Hugo (2026-11-13, perguntas diretas)
- **Tela inicial:** personagem + torre. Tela nova **Herói**, de cima para baixo: personagem → radar → torre.
- **Personagem:** silhueta neon, herói único. A aparência muda pelo nível e pelas peças ganhas nas trilhas.
- **Barra de baixo:** Herói · Hoje · Treino · Ideias. Financeiro, Quadro da semana e Configurações ficam no ☰.
- **Mecânicas escolhidas:** missões diárias, atributos + árvore. **Fora por enquanto:** chefão semanal e inventário de cosméticos.
- **Atributos (5):** Física, Mental, Profissional, Financeira e **Espiritual** (no lugar de Pessoal).
- **Missões iniciais:** Ler 10 páginas (+20, Mental) e Meditar 10 min (+10, Espiritual). Dá para criar e editar outras.
- **Torre:** 1 andar por semana, na cor do brasão. 7 janelas; a janela acende quando **todas as missões do dia** foram feitas. Toque no andar abre a semana.
- **Hoje:** missões em cima, compromissos embaixo. O treino do dia é um compromisso com o botão INICIAR.
- **Árvore:** trilha vertical por atributo (I, II, III…), aberta tocando no radar. Cada nó tem um marco e uma recompensa (título ou peça).
- Rascunho visual: `docs/superpowers/mockups/heroi-2026-11.html`.

### Rodada 4 (confirmado)
- O visual geral foi aprovado. **A torre e o personagem vão ser redesenhados na hora de construir** (o Hugo quer mudar o desenho dos dois).
- **Tarefas Pessoal:** dão XP só para o nível geral, sem atributo. Espiritual vem só de missões (ex.: meditar).
- **Torre × Quadro da semana:** tocar num andar abre o Quadro da semana que já existe; o item sai do ☰.
- **Domingo:** a revelação passa a mostrar o andar novo subindo na torre e o brasão pousando nele. Se destravou peça, o herói aparece vestindo.

### Rodada 5: herói e torre redesenhados (rascunho 4)
- Referências do Hugo: fantasia sombria medieval. Um encapuzado de máscara branca e capa longa, um patrulheiro de elmo, gibão verde acolchoado e arco, e um andarilho de couro rústico com escudo de madeira e maça.
- **Herói em 3 estágios:**

  | Estágio | Níveis | Visual |
  |---|---|---|
  | Andarilho | 1–9 | couro, escudo, maça |
  | Patrulheiro | 10–24 | elmo, gibão, arco |
  | Guardião Sombrio | 25+ | capuz, máscara, capa, amuleto |

  As peças vêm das trilhas. O neon fica só nos olhos e no amuleto.
- **Torre de castelo** desenhada em pedra:
  - 1 andar por semana, com 7 seteiras que acendem (luz quente) nos dias cumpridos
  - estandarte na cor do brasão e bandeira verde quando bateu a meta de treino
  - o andar atual "em obra", com andaime e guindaste
  - base com portão e chão verde
- Rascunho: `docs/superpowers/mockups/heroi-castelo-2026-11.html`. Desenho em SVG feito à mão.
- **Arte final:** se o Hugo quiser o nível de ilustração das referências (pintura digital), terá que gerar ou encomendar imagens PNG por estágio. O código troca a imagem por nível do mesmo jeito.

### Suposições minhas (confirmar)
- Faculdade → Mental; Trabalho → Profissional; Treino → Física; Agente Finanças → Financeira.
- A cor do andar = brasão das tarefas da semana. O treino aparece como bandeira ⚑ no andar quando bateu a meta de treino.
- Nível do atributo usa a mesma curva do nível geral.

## O que já existe no app
- XP por tarefa (fácil 10, média 25, difícil 50), nível geral e brasão semanal RPG: bronze, prata, ouro, diamante e supremo.
- Revelação do brasão no domingo e quadro da semana.
- Aba Treino em construção: XP por série, recorde pessoal, brasão de treino, sequência de semanas e conquistas.

## Referência vista (app enviado pelo Hugo, prints de 13/11)
- **Tela "Lar"** com classe do personagem ("Guerreiro") e 3 números grandes: Total de XP, Nível e Ofensivas (sequência).
- **Energia 8/10:** uma barra de recurso diário.
- **Árvore de habilidades em radar** com 5 atributos: Física, Mental, Espiritual, Profissional e Financeira.
- **Compromissos do dia:** itens com hora. O treino aparece como compromisso com o botão INICIAR.
- **Missões diárias:** hábitos que se repetem todo dia, com XP fixo (Meditação 10 min +10, Ler 10 páginas +20, Treinar 50 min +35, Correr 2 km +20).
- **Batalhas e chefões:** desafios com "chefe".
- **Barra de baixo:** Lar, Habilidades, Missões, Chefões, Inventário, Classificação e Configurações (7 itens, apertado).

Outra referência citada: um app com **torre que cresce** conforme os hábitos são cumpridos (nome a confirmar com o Hugo).

## Ideias adaptadas para o Agenda

### 1. Personagem que evolui
- Avatar com classe escolhida no início (ex.: Guerreiro, Mago, Ranger). A classe só muda o visual e o título; não muda as regras.
- A aparência evolui com o nível (armadura, capa, aura) e os brasões viram equipamentos (ex.: 4 brasões de ouro liberam o "elmo dourado").
- Estilo coerente com o tema Neon e com os brasões em SVG que já existem.

### 2. Atributos e árvore de habilidades
Cada área do app alimenta um atributo, e o radar mostra o equilíbrio da vida:

| Atributo | De onde vem o XP |
|---|---|
| Física | Treino: séries, treinos e recordes |
| Mental | Faculdade e estudo: tarefas da área Faculdade e missões de leitura |
| Profissional | Tarefas da área Trabalho |
| Financeira | Agente Finanças: registrar gastos, ficar dentro do orçamento, investir no mês |
| Pessoal ou Espiritual | Tarefas pessoais e missões como meditação |

- **Árvore:** cada atributo tem nós que destravam por marcos. Exemplos: Física I = 4 semanas seguidas de treino; Financeira I = 30 dias registrando gastos.
- Os nós dão título e cosmético, não poder. Assim o jogo não vira obrigação.

### 3. Torre de evolução
- Cada dia cumprido coloca um bloco; cada semana fecha um andar com o brasão da semana no topo.
- Dia perdido deixa um bloco rachado, mas **a torre não cai** (punição leve).
- Rolar a torre para baixo mostra o histórico: substitui o "quadro da semana" como memória visual.
- Combina com o que já existe: o brasão semanal vira o andar.

### 4. Compromissos × Missões diárias
- **Compromissos** = as tarefas que já existem (com dia e hora, feitas uma vez).
- **Missões diárias** = conceito novo: hábitos que se repetem (meditar, ler, alongar, beber água), com XP fixo e sequência própria.
- O treino do dia entra como compromisso automático com o botão **Iniciar**, que abre o treino ao vivo.

### 5. Chefão da semana
- Toda segunda nasce um chefe com vida igual à meta de XP da semana.
- Cada tarefa, missão ou série causa dano.
- Derrotar o chefe abre um baú com um cosmético ou título.
- Nomes temáticos: "Procrastinação", "Dragão do Caos", "Sombra da Preguiça".

### 6. Outros elementos possíveis
- **Ofensivas (sequências)** por missão e geral, com "escudo" que salva 1 dia perdido por semana.
- **Inventário:** cosméticos ganhos em baús, sem moeda nem loja (evita inflação e complexidade).
- **Energia:** questionável. Pode virar "descanso": bater a meta de sono ou de folga recupera energia. Deixar para depois.
- **Classificação:** o app é de um usuário só, então ela compara você com você mesmo (melhor semana, melhor mês).

## Princípios
- Uma moeda só: **XP**. Recompensas extras são cosméticas.
- Punição leve: nada se perde de vez.
- Os dados vêm do que o Hugo já faz (tarefas, treino, finanças); evitar marcar coisa duas vezes.
- No máximo 5 botões na barra de baixo. O resto fica no ☰.

## Referências para pesquisar
- Habitica: classes, chefões em grupo, equipamentos.
- Finch: bichinho que evolui com autocuidado.
- Forest: árvore que cresce enquanto você foca.
- Duolingo: ofensivas, escudo de ofensiva, ligas.
- O app da torre que o Hugo viu (pedir o nome).
- O app dos prints (pedir o nome).

## Pesquisa de referências (2026-11-13)

### Habitica
Fontes: wiki de fãs e reviews; podem estar desatualizadas.
- **Tipos de tarefa:** Hábitos, Diárias e Afazeres.
  - Diária feita dá XP e ouro; diária não feita até o fim do dia tira vida.
  - Afazer nunca tira vida e vale mais quanto mais tempo espera.
- **Chefões:** completar tarefas causa dano no chefe, e diárias perdidas fazem o grupo levar dano.
- **Classes:** 4 classes, com bônus, habilidades e equipamentos próprios. A classe é escolhida no nível 10.
- **Vida zerada:** perde nível, ouro e um equipamento. É uma punição pesada, e é o ponto mais criticado.
- **Lição para nós:** o chefão funciona bem como "dano por tarefa feita". Evitar a punição pesada: no Agenda, perder não tira nada conquistado.

### Finch
- Autocuidado gera **energia**, que manda o passarinho em **aventuras**; ele cresce de filhote a adulto com o tempo.
- Moeda (rainbow stones) compra roupas e móveis.
- Reviews criticam que o app não explica bem energia e moeda.
- **Lição:** um personagem que cresce com o tempo cria vínculo, mas cada mecânica precisa ser explicada na própria tela.

### Forest
- Você liga um cronômetro e a árvore cresce enquanto você foca (10 a 120 min). Se sair para outro app, a árvore morre.
- As sessões viram uma floresta visível.
- **Lição:** o histórico visual acumulado (floresta) é o mesmo princípio da nossa torre. O "morre se sair" é punição forte; para nós, bloco rachado em vez de destruído.

### Apps no estilo "vida RPG" com atributos
- **SkillUp:** 5 habilidades (Força, Intelecto, Criatividade, Disciplina, Educação financeira). Tudo local, sem conta.
- **Lvluplife:** XP em habilidades personalizadas e atributos centrais. Assinatura de US$ 4,99/mês.
- **Skillix:** atividades viram missões; o tempo gasto gera recursos para construir o assentamento do personagem.
  - **Lição:** é a versão "construção", parecida com a torre.
- **Levelite:** app brasileiro (Uberaba, MG) de rotina em RPG, com missões de guilda.

### Torre
- Não achei um app de torre confiável. Só apareceu uma página de demonstração ("Stack": um cubo por hábito, a torre zera se perder o dia), sem página oficial na loja.
- Os mais próximos usam árvore ou planta: Habit Tree, HabitOak e Habit Plant.
- Pedir ao Hugo o nome do app da torre que ele viu.

### Conclusões para o Agenda
1. A combinação que ninguém faz bem é **dados reais**: tarefas, treino e finanças pelo agente. Os atributos do radar podem vir sozinhos, sem marcar nada a mais. É o diferencial.
2. **Punição leve** é consenso nas críticas (Habitica e Forest são as mais citadas como frustrantes).
3. **Explicar cada mecânica na tela** (crítica ao Finch).
4. O **histórico visual acumulado** (floresta, torre, assentamento) é o que mais prende no longo prazo, e combina com o brasão semanal.

### Fontes
- Habitica: https://habitica.fandom.com/wiki/Class_System · https://habitica.fandom.com/es/wiki/Glosario?oldid=825 · https://tvtropes.org/pmwiki/pmwiki.php/Website/Habitica
- Finch: https://www.engadget.com/apps/this-self-care-virtual-pet-is-helping-me-get-my-act-together-160027169.html · https://yourstory.com/2022/06/app-review-self-care-pet-finch-gamifies-mental-wellbeing
- Forest: https://forestapp.cc/ · https://makeheadway.com/blog/forest-app-review/
- SkillUp: https://www.indiehackers.com/product/skillup · Skillix: https://apps.apple.com/lu/app/id6766952006 · Levelite: https://apps.apple.com/be/app/levelite/id6743447435
- Árvore e planta: https://apps.apple.com/py/app/habit-tracker-habit-tree/id6740733412?l=en-GB · https://apps.apple.com/us/app/habit-plant/id6755801570

## Perguntas em aberto
1. Personagem: qual estilo (silhueta neon, pixel art, ilustração)? Escolher a classe ou ter uma só?
2. Qual atributo fica no lugar de "Espiritual"?
3. Torre ou árvore como peça central da tela inicial? Ou os dois (torre = histórico, árvore = atributos)?
4. Missões diárias: quais hábitos de verdade entram?
5. Chefão semanal: vale a pena ou é coisa demais junto com o brasão?
