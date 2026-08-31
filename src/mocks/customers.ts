import type { CustomerDetail } from '../types/customer'

export const mockCustomers: CustomerDetail[] = [
  {
    id: 'cli-1001', name: 'Maria Silva', phone: '(11) 99876-5432', active: true,
    notes: 'Prefere receber a confirmação pelo WhatsApp. Entregar na portaria.',
    addresses: [
      { id: 'end-1001-casa', label: 'Casa', street: 'Rua das Flores', number: '120', neighborhood: 'Centro', city: 'São Paulo', state: 'SP', postalCode: '01001-000' },
      { id: 'end-1001-trabalho', label: 'Trabalho', street: 'Avenida Paulista', number: '900', complement: '8º andar', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP', postalCode: '01310-100' }
    ],
    preferences: [{ id: 'pref-1001-1', description: 'Sem arroz' }, { id: 'pref-1001-2', description: 'Substituir arroz por legumes' }],
    dietaryRestrictions: ['Lactose'], preferredDeliveryPerson: 'Carlos Souza', preferredPaymentCondition: 'À vista', preferredPaymentMethod: 'Pix'
  },
  {
    id: 'cli-1002', name: 'João Souza', phone: '(11) 98765-4321', active: true,
    addresses: [{ id: 'end-1002', label: 'Casa', street: 'Rua Augusta', number: '440', neighborhood: 'Consolação', city: 'São Paulo', state: 'SP' }],
    preferences: [], dietaryRestrictions: []
  },
  {
    id: 'cli-1003', name: 'Ana Lima', phone: '(11) 97654-3210', active: true,
    notes: 'Ligação somente após as 10h.',
    addresses: [{ id: 'end-1003', label: 'Trabalho', street: 'Rua Vergueiro', number: '1880', neighborhood: 'Vila Mariana', city: 'São Paulo', state: 'SP' }],
    preferences: [{ id: 'pref-1003-1', description: 'Reduzir carboidrato' }], dietaryRestrictions: ['Glúten', 'Castanhas'], preferredPaymentMethod: 'Cartão'
  },
  {
    id: 'cli-1004', name: 'Carlos Mendes', phone: '(11) 96543-2109', active: false,
    addresses: [{ id: 'end-1004', label: 'Casa', street: 'Rua Harmonia', number: '74', neighborhood: 'Vila Madalena', city: 'São Paulo', state: 'SP' }],
    preferences: [], dietaryRestrictions: ['Amendoim']
  },
  {
    id: 'cli-1005', name: 'Beatriz Rocha', phone: '(11) 95432-1098', active: true,
    addresses: [{ id: 'end-1005', street: 'Rua Tito', number: '305', neighborhood: 'Lapa', city: 'São Paulo', state: 'SP' }],
    preferences: [{ id: 'pref-1005-1', description: 'Pouco sal' }], dietaryRestrictions: []
  },
  {
    id: 'cli-1006', name: 'Roberto Alves', phone: '(11) 94321-0987', active: true,
    addresses: [{ id: 'end-1006', label: 'Casa', street: 'Rua Cardoso de Almeida', number: '810', neighborhood: 'Perdizes', city: 'São Paulo', state: 'SP' }],
    preferences: [{ id: 'pref-1006-1', description: 'Sem feijão' }, { id: 'pref-1006-2', description: 'Salada separada' }], dietaryRestrictions: ['Ovo', 'Soja']
  },
  {
    id: 'cli-1007', name: 'Fernanda Nunes', phone: '(11) 93210-9876', active: true,
    addresses: [{ id: 'end-1007', label: 'Trabalho', street: 'Avenida Angélica', number: '510', neighborhood: 'Santa Cecília', city: 'São Paulo', state: 'SP' }],
    preferences: [], dietaryRestrictions: []
  },
  {
    id: 'cli-1008', name: 'Lucas Martins', phone: '(11) 92109-8765', active: true,
    addresses: [{ id: 'end-1008', label: 'Casa', street: 'Rua dos Pinheiros', number: '1080', neighborhood: 'Pinheiros', city: 'São Paulo', state: 'SP' }],
    preferences: [{ id: 'pref-1008-1', description: 'Proteína bem passada' }], dietaryRestrictions: ['Lactose']
  },
  {
    id: 'cli-1009', name: 'Patrícia Gomes', phone: '(11) 91098-7654', active: true,
    addresses: [{ id: 'end-1009', label: 'Casa', street: 'Rua França Pinto', number: '260', neighborhood: 'Vila Mariana', city: 'São Paulo', state: 'SP' }],
    preferences: [], dietaryRestrictions: []
  },
  {
    id: 'cli-1010', name: 'Rafael Cardoso', phone: '(11) 90987-6543', active: true,
    addresses: [{ id: 'end-1010', label: 'Trabalho', street: 'Rua Funchal', number: '418', neighborhood: 'Vila Olímpia', city: 'São Paulo', state: 'SP' }],
    preferences: [{ id: 'pref-1010-1', description: 'Substituir arroz por legumes' }], dietaryRestrictions: ['Glúten']
  },
  {
    id: 'cli-1011', name: 'Camila Ribeiro', phone: '(11) 99870-1122', active: true,
    addresses: [{ id: 'end-1011', label: 'Casa', street: 'Rua Pamplona', number: '612', neighborhood: 'Jardim Paulista', city: 'São Paulo', state: 'SP' }],
    preferences: [], dietaryRestrictions: []
  },
  {
    id: 'cli-1012', name: 'Eduardo Freitas', phone: '(11) 98760-2233', active: true,
    addresses: [{ id: 'end-1012', label: 'Casa', street: 'Rua Clélia', number: '920', neighborhood: 'Água Branca', city: 'São Paulo', state: 'SP' }],
    preferences: [{ id: 'pref-1012-1', description: 'Sem arroz' }], dietaryRestrictions: ['Castanhas']
  }
]
