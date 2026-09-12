export const MENU_ITEMS = [
  {
    id: 'samosa',
    name: 'Samosa',
    price: 12,
    category: 'Snacks',
    unit: 'pcs',
    isVeg: true,
    image: '/images/samosa.png',
    fallbackImage: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'veg_puff',
    name: 'Veg Puff',
    price: 25,
    category: 'Snacks',
    unit: 'pcs',
    isVeg: true,
    image: '/images/veg-puff.png',
    fallbackImage: 'https://images.unsplash.com/photo-1628294895950-9805252327bc?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'egg_puff',
    name: 'Egg Puff',
    price: 25,
    category: 'Snacks',
    unit: 'pcs',
    isVeg: false,
    image: '/images/egg-puff.png',
    fallbackImage: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'chicken_puff',
    name: 'Chicken Puff',
    price: 30,
    category: 'Snacks',
    unit: 'pcs',
    isVeg: false,
    image: '/images/chicken-puff.png',
    fallbackImage: 'https://images.unsplash.com/photo-1628294895950-9805252327bc?w=600&auto=format&fit=crop&q=80',
  },
];

export const BLOCKS = [
  { id: 'CB', code: 'CB', name: 'Civil Block' },
  { id: 'CM', code: 'CM', name: 'Computer Science and Mechanical Block' },
  { id: 'FB', code: 'FB', name: 'First year Block' },
  { id: 'PG', code: 'PG', name: 'Post Graduate Block' },
];

export const UPI_CONFIG = {
  vpa: '8143160328@ybl',
  name: 'Deliz',
  merchantCode: '5499',
  note: 'Deliz Snack Order',
};
