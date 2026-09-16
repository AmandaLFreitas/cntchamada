# Corrigir a aba Finalizando o Curso por horas presenciais

## Ajuste da regra
- Remover do cálculo qualquer estimativa baseada em data de início, semanas ou meses transcorridos.
- Calcular cada matrícula separadamente, somando somente registros com status **Presente** nos horários vinculados àquele curso.
- Converter cada presença em horas pela duração real do respectivo horário.
- Exibir somente matrículas ativas com percentual de presença igual ou superior a 80% e inferior a 100%.
- Não misturar presenças entre cursos diferentes do mesmo aluno.

## Informações exibidas
- Manter nome, curso, data de início e previsão de término existente.
- Acrescentar carga horária total, horas realizadas, percentual concluído e horas restantes.
- Retirar “dias restantes” da aba, pois o critério definitivo passa a ser em horas.

## Atualização e validação
- Atualizar a lista imediatamente ao adicionar, alterar ou remover uma presença.
- Validar os limites: abaixo de 80% não aparece; de 80% até abaixo de 100% aparece; 100% não aparece como “Finalizando”.
- Preservar unidade, permissões e todas as demais funcionalidades.
