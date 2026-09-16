# Corrigir a previsão de término na Visão Geral

## Implementação
- Calcular cada matrícula separadamente, usando sua carga horária e somente presenças nos horários vinculados ao curso.
- Converter cada presença em horas pela duração real do horário e calcular as horas restantes.
- Projetar as horas restantes nas próximas datas da grade atual, pulando feriados e recessos já configurados.
- Manter o texto e o formato atuais do card, alterando apenas a origem da data prevista.

## Atualização
- Recalcular a previsão após mudanças de presença, horários ou carga horária, reutilizando as atualizações já disparadas pelo sistema.

## Preservação e validação
- Não alterar outras informações, abas, permissões, unidades ou dados históricos.
- Validar matrículas distintas do mesmo aluno, faltas e horários com durações diferentes.
