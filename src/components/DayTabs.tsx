import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DAYS_OF_WEEK } from '@/lib/constants';

interface DayTabsProps {
  value: string;
  onChange: (day: string) => void;
}

export function DayTabs({ value, onChange }: DayTabsProps) {
  return (
    <Tabs value={value} onValueChange={onChange}>
      <TabsList className="w-full justify-start">
        {DAYS_OF_WEEK.map(day => (
          <TabsTrigger key={day} value={day} className="flex-1 md:flex-none">
            {day}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
