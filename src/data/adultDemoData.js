export const shoppingSeed = [
  { id: 'washing-liquid', name: 'Washing-up liquid', category: 'Kitchen', detail: '1 left', state: 'low' },
  { id: 'milk', name: 'Milk', category: 'Fridge', detail: '1 carton left', state: 'low' },
  { id: 'toilet-paper', name: 'Toilet paper', category: 'Bathroom', detail: 'Out of stock', state: 'out' },
  { id: 'bread', name: 'Bread', category: 'Bakery', detail: '1 loaf', state: 'list' },
  { id: 'chicken', name: 'Chicken breasts', category: 'Food', detail: '500 g', state: 'list' },
  { id: 'apples', name: 'Apples', category: 'Food', detail: '6', state: 'list' },
]

export const noticeSeed = [
  { id: 1, title: 'Plumber visiting Tuesday', body: 'Between 9am and 12pm. Please keep the hallway clear.', priority: 'urgent', author: 'Alex', expires: '2 days' },
  { id: 2, title: 'Rent due Friday', body: 'Please pay by end of day.', priority: 'important', author: 'Sam', expires: '5 days' },
  { id: 3, title: 'Bin collection changed', body: 'The new collection day is Wednesday.', priority: 'normal', author: 'Jordan', expires: '9 days' },
]

export const messageSeed = [
  { id: 1, author: 'Sam', body: 'Can someone pick up milk on the way home?', time: '9:41 am', mine: false },
  { id: 2, author: 'Jordan', body: 'I’ll do a full clean of the bathroom tomorrow.', time: 'Yesterday', mine: false },
  { id: 3, author: 'You', body: 'Thanks. I also added the plumber notice.', time: 'Yesterday', mine: true },
  { id: 4, author: 'Casey', body: 'Don’t forget rent is due Friday.', time: 'Mon', mine: false },
]

export const activitySeed = [
  { id: 1, member: 'Alex', action: 'completed a quick clean', subject: 'Kitchen floor', time: 'Today, 9:41am', tone: 'green' },
  { id: 2, member: 'Sam', action: 'marked an item as running low', subject: 'Washing-up liquid', time: 'Yesterday', tone: 'amber' },
  { id: 3, member: 'Jordan', action: 'posted a notice', subject: 'Rent due Friday', time: 'Yesterday', tone: 'blue' },
]
