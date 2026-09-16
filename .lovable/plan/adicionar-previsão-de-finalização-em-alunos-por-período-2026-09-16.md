# Adicionar previsão de finalização em Alunos por Período

## Implementação
- Calcular a previsão separadamente para cada matrícula, usando a data real de início, a carga horária total e a soma das durações dos horários semanais vinculados ao curso.
- Reutilizar a regra de calendário existente para pular feriados e recessos/férias configurados no sistema.
- Exibir a nova coluna **Previsão de Finalização** nas duas seções da aba.
- Incluir a mesma informação nas exportações para Excel, PDF e impressão, respeitando os filtros atuais.

## Preservação
- Não alterar dados, filtros, unidades, permissões ou outras abas.
- Manter intacta a regra presencial da aba **Finalizando o Curso**; esta previsão será apenas uma estimativa de calendário.

## Validação
- Conferir matrículas com diferentes cargas e frequências semanais.
- Validar a tabela e as exportações sem alterar os critérios atuais de inclusão nas duas seções.
