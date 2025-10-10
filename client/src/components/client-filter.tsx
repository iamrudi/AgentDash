import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Client } from "@shared/schema";
import { Building2 } from "lucide-react";

interface ClientFilterProps {
  clients: Client[] | undefined;
  selectedClientId: string;
  onClientChange: (clientId: string) => void;
  label?: string;
  testId?: string;
}

export function ClientFilter({ 
  clients, 
  selectedClientId, 
  onClientChange, 
  label = "Filter by Client",
  testId = "select-client-filter" 
}: ClientFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedClientId} onValueChange={onClientChange}>
        <SelectTrigger className="w-[200px]" data-testid={testId}>
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Clients</SelectItem>
          {clients?.map((client) => (
            <SelectItem key={client.id} value={client.id}>
              {client.companyName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
