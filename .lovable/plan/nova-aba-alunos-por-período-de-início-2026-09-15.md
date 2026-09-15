# Nova aba — Alunos por Período de Início

## Objetivo
Criar uma aba de consulta, separada por unidade, que organize os cursos dos alunos pela data real do primeiro dia de aula e permita exportar exatamente o resultado selecionado.

## O que será criado
- Nova opção **Alunos por Período de Início** no menu e nova página acessível aos usuários administrativos/restritos atuais; professores continuam apenas com suas abas permitidas.
- Seletor de **ano**, iniciado no ano atual, e busca por nome/telefone/curso.
- Duas seções independentes:
  1. **Início de janeiro a junho**: cursos cuja data de primeiro dia esteja entre 01/01 e 30/06 do ano escolhido.
  2. **Início de junho a setembro e 4h+ semanais**: cursos cuja data esteja entre 01/06 e 30/09 e cuja soma dos horários semanais vinculados ao curso seja de pelo menos 4 horas.
- Junho poderá aparecer nas duas seções, conforme os intervalos solicitados.
- Um aluno com mais de um curso poderá aparecer uma vez por curso elegível, sempre com a data, carga e horários correspondentes àquele curso.

## Informações e interação
- Cada linha mostrará os dados principais para conferência: aluno, telefone, curso, data de início, carga horária total, carga semanal, dias/horários, status e unidade.
- Ao clicar no aluno, abrir as informações completas já cadastradas, reutilizando a visualização existente e respeitando as restrições de dados por perfil.
- Registros sem uma data válida de primeiro dia de aula não entrarão nas seções; não será usada a data de cadastro nem a data de matrícula como substituição.
- A lista será derivada diretamente de alunos, cursos e horários existentes, sem criar tabela ou duplicar dados.

## Exportações
- **PDF** e **Imprimir**: documento com cabeçalho da unidade/ano e as duas seções claramente identificadas.
- **Excel**: arquivo com duas planilhas separadas, uma para cada seção.
- Busca e ano selecionado serão respeitados nas três formas de exportação.
- Os campos exportados serão os mesmos apresentados na listagem de cada curso.

## Regras técnicas
- Todas as consultas serão filtradas pela unidade ativa, mantendo Toledo e Cascavel isoladas.
- A carga semanal será calculada pela duração real de cada horário ligado ao `student_course`, somando cada faixa de dia/horário uma única vez.
- Alterações em data de início, curso, carga total ou horários refletirão automaticamente após a atualização dos dados existentes.
- Nenhuma funcionalidade ou estrutura atual do banco será alterada.

## Validação
- Conferir os limites dos períodos, inclusive 01/01, 30/06, 01/06 e 30/09.
- Conferir cursos com exatamente 4h semanais, acima e abaixo desse limite.
- Conferir aluno com vários cursos e a troca de unidade.
- Conferir busca, ano e conteúdo das exportações.
- Validar a página em telas grandes e pequenas e confirmar que não há erros na aplicação.
