import type { Component } from 'vue'

export type CommercialSection = 'clientes' | 'cardapios'
export type CustomerPage = 'list' | 'new' | 'detail' | 'edit'
export type MenuPage = 'list' | 'new' | 'edit'

export interface CommercialPageConfig {
  title: string
  subtitle?: string
  icon: Component
}
