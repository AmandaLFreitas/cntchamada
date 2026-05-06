# Plano de Ajustes do Sistema CNT

Vou implementar os 13 itens em blocos lógicos. Antes de começar, preciso confirmar alguns pontos críticos que afetam a viabilidade/segurança.

## ⚠️ Pontos que precisam de decisão antes de executar

### A) Item 12 — "Criptografia de CPF, Telefone, Nome completo"
Criptografar **nome completo** quebra o sistema inteiro: busca de alunos, listagens, chamada, certificados, relatórios, ordenação alfabética. O nome é exibido em praticamente toda tela. Recomendo:
- **Manter nome em texto claro** (já está protegido por autenticação + RLS)
- **Não criptografar CPF/telefone no banco** — em vez disso, restringir visualização via roles (Amanda/Henrique já não veem CPF). Criptografia simétrica no Postgres exigiria descriptografar em quase todas as queries, destruindo a performance que o item 9 pede para melhorar.
- **Mascarar** CPF/telefone na UI para perfis restritos (já parcialmente feito).

Se você insistir em criptografia real, será preciso reescrever várias telas e a performance vai piorar — o oposto do item 9.

### B) Item 12 — "Backup automático do banco"
O Lovable Cloud já faz **backups diários automáticos** da infraestrutura. Não há nada para implementar no código. Posso só confirmar isso na resposta.

### C) Item 11 — "Remover ícone de notificações da navegação"
Existem 4 sininhos hoje: **Finalizando** (header), **Aniversariantes** (popup), **Aulas experimentais** (popup), **Conclusão de curso** (popup). Vou assumir **remover apenas o sininho do header (FinalizingNotification)** e manter os popups flutuantes — me avise se quiser remover todos.

### D) Item 10 — "Aba Resgate"
Critério: aluno a **1 mês de finalizar** = previsão de término ≤ 30 dias. O cálculo já existe (Start Date + total horas / horas semanais). Vou:
- Criar página `/resgate` no menu
- Mostrar automaticamente todo aluno com previsão ≤ 30 dias E < 100% concluído
- Adicionar ícone na chamada que abre/marca o aluno; mas como você disse "ao clicar no ícone aluno é enviado", vou interpretar como **toggle manual** (campo `rescue_flagged` no `student_courses`) **somado** ao critério automático.

---

## 📋 Implementação (assumindo aprovação dos itens acima)

### Bloco 1 — Aulas Experimentais (itens 1, 2, 3, 4)
- `src/pages/TrialLessons.tsx`: 
  - Cores de fundo da linha por status: `OK`/`OK.FECHOU`→verde claro, `NÃO VEIO`→vermelho claro + **borda laranja + badge "Entrar em contato"**, `DESMARCOU`→roxo + alerta laranja, `REMARCOU`→roxo
  - Linha azul claro para destacar registros do dia
  - Nova coluna **Observações** após Situação (texto livre, salvo na tabela)
- Migração: adicionar coluna `observations TEXT` em `trial_lessons`
- `TrialLessonNotification.tsx`: badge laranja quando houver "NÃO VEIO" ou "DESMARCOU"

### Bloco 2 — WhatsApp (item 5)
- Função `openWhatsApp(phone)` em `src/lib/utils.ts` — abre `https://wa.me/55<numero>` em nova aba
- Aplicar em: `TrialLessons` (nome + telefone), `Students` (nome + telefone), `Birthdays`, `Finalizing`, `Resgate`

### Bloco 3 — Chamada (itens 6, 7, 8)
- `Attendance.tsx`:
  - **Toggle**: clicar de novo no botão atual desmarca (volta para neutro/null) — hoje só substitui
  - Cor verde para presença, vermelha para falta (já existe parcialmente, reforçar)
  - Novo ícone de **apostila** (📘 `BookOpen`) ao lado do ícone de observação:
    - azul se `material_sent=true`, vermelho se `false`
    - clicável para alternar (admin) ou só visual (restrito)
  - Ícone de **resgate** (item 10): aparece quando previsão ≤ 30 dias, clicável p/ marcar

### Bloco 4 — Aba Resgate (item 10)
- Migração: `ALTER TABLE student_courses ADD COLUMN rescue_flagged BOOLEAN DEFAULT false`
- Nova rota `/resgate` + `pages/Rescue.tsx`
- Item no `AppSidebar`
- Lista alunos com `rescue_flagged=true` OU previsão ≤ 30 dias e < 100%
- Mesma estrutura visual da chamada/finalizando

### Bloco 5 — Header (item 11)
- Remover `<FinalizingNotification />` do `Layout.tsx`

### Bloco 6 — Performance (item 9)
- Adicionar índices: `attendance(student_id, date)`, `attendance(school_id, date)`, `student_schedules(time_slot_id)`, `student_courses(student_id, school_id)`
- Aumentar `staleTime` no `QueryClient` (60s) e `gcTime`
- `useSaveAttendance`: usar **mutation otimista** (atualiza UI antes da resposta)
- Reduzir invalidações em cascata; invalidar só a query afetada
- Paginar/limitar queries de listagem ao `school_id` ativo

### Bloco 7 — Segurança (item 12, versão pragmática)
- Endurecer RLS: substituir `USING (true)` por `USING (auth.uid() IS NOT NULL)` em todas as tabelas — atualmente qualquer pessoa com a anon key consegue ler tudo.
- Manter mascaramento de CPF/telefone na UI para `restricted`.
- Confirmar backups automáticos do Cloud.
- **Sem criptografia de coluna** (ver item A acima).

---

## ❓ Confirme antes de eu começar

1. **OK em não criptografar nome/CPF/telefone** e em vez disso reforçar RLS + mascaramento? (recomendado)
2. **Remover só o sino do header** (Finalizando) e manter popups? Ou remover todos?
3. **Aba Resgate**: critério automático (≤30 dias) + toggle manual via ícone na chamada — ok?
4. **Coluna Observações nas experimentais**: editável inline (clicar e digitar) ou via dialog?

Responda essas 4 e eu executo tudo de uma vez.