import type { CommercialSection, CustomerPage, FinancialPage, MenuPage, PlanPage } from './commercial'
import type { AuthenticatedApiRequest } from './menu'

export interface CommercialPageProps {
  section?: CommercialSection
  customerPage?: CustomerPage
  customerId?: string
  menuPage?: MenuPage
  menuDate?: string
  planPage?: PlanPage
  planId?: string
  financialPage?: FinancialPage
  chargeId?: string
  apiRequest?: AuthenticatedApiRequest
}
