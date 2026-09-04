import { ArrowUpDownIcon, FunnelIcon, SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"

export function ProviderSearchBar() {
  return (
    <div
      className="flex items-center gap-2"
      role="search"
      aria-label="Find a status provider"
    >
      <InputGroup>
        <InputGroupInput
          type="search"
          placeholder="Search providers by name..."
          aria-label="Search providers by name"
        />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
      </InputGroup>
      <Button type="button" variant="outline" size="icon" aria-label="Filters">
        <FunnelIcon />
      </Button>
      <Button type="button" variant="outline" size="icon" aria-label="Sort">
        <ArrowUpDownIcon />
      </Button>
    </div>
  )
}
