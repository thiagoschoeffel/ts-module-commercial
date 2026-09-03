import type { Component } from 'vue'

export type CommercialSection = 'clientes' | 'cardapios' | 'planos' | 'financeiro'
export type CustomerPage = 'list' | 'new' | 'detail' | 'edit'
export type MenuPage = 'list' | 'new' | 'edit'
export type PlanPage = 'list' | 'new' | 'edit' | 'new-acquisition' | 'new-movement'
export type FinancialPage = 'list' | 'charge-detail' | 'new-payment'

export interface CommercialPageConfig {
  title: string
  subtitle?: string
  icon: Component
}
