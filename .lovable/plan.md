# Adicionar exportações na Visão Geral

## Implementação
- Carregar, para a unidade selecionada, todos os horários de segunda a sábado e todas as matrículas vinculadas, incluindo horários vazios.
- Reutilizar a mesma lógica da Visão Geral para carga horária, horas semanais, início, primeira presença, previsão por progresso real e status.
- Organizar um conjunto semanal único por dia, horário e aluno, sem depender do dia selecionado ou da busca da tela.

## Exportações
- Adicionar no topo os botões Excel, PDF e Imprimir, com estado de geração e mensagens em caso de erro.
- Gerar Excel profissional com título, unidade, data, cabeçalho congelado, filtros, larguras, quebra de texto, bordas e configuração para impressão.
- Gerar PDF A4 em paisagem com cabeçalho, seções por dia e horário, horários vazios, quebra segura de páginas e numeração.
- Abrir uma janela de impressão contendo somente o relatório semanal, em A4, sem menus ou controles do sistema.

## Validação
- Conferir que segunda a sábado e todos os horários configurados aparecem, inclusive os vazios.
- Conferir a separação por unidade, a ordem cronológica e os dados por matrícula.
- Validar os três botões em desktop e tablet sem alterar outras telas ou regras.
