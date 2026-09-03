import type { Component } from 'vue'

export type CommercialSection = 'clientes' | 'cardapios' | 'planos'
export type CustomerPage = 'list' | 'new' | 'detail' | 'edit'
export type MenuPage = 'list' | 'new' | 'edit'
export type PlanPage = 'list' | 'new' | 'edit' | 'new-acquisition' | 'new-movement'

export interface CommercialPageConfig {
  title: string
  subtitle?: string
  icon: Component
}
