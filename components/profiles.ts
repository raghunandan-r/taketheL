export interface Profile {
  id: number
  name: string
  age: number
  neighborhood: string
  line: string
  stop: string
  bio: string
  interests: string[]
  image: string
  distance: string
}

export const profiles: Profile[] = [
  {
    id: 1,
    name: "Mia",
    age: 27,
    neighborhood: "Williamsburg",
    line: "L",
    stop: "Bedford Ave",
    bio: "Dog mom, vintage collector, and weekend brunch connoisseur. Looking for someone who doesn't mind long walks across the Williamsburg Bridge.",
    interests: ["Vinyl Records", "Thrift Shopping", "Yoga", "Coffee"],
    image: "/profiles/profile-1.jpg",
    distance: "2 stops away",
  },
  {
    id: 2,
    name: "James",
    age: 31,
    neighborhood: "Upper West Side",
    line: "1",
    stop: "79th St",
    bio: "Architect by day, jazz pianist by night. I know every great restaurant within 3 blocks of every subway stop in Manhattan.",
    interests: ["Jazz", "Architecture", "Cooking", "Museums"],
    image: "/profiles/profile-2.jpg",
    distance: "5 stops away",
  },
  {
    id: 3,
    name: "Sofia",
    age: 25,
    neighborhood: "Astoria",
    line: "N",
    stop: "Astoria Blvd",
    bio: "Painter, taco enthusiast, and sunset chaser. My ideal date is picnicking in Astoria Park and watching the city lights come on.",
    interests: ["Painting", "Street Food", "Parks", "Photography"],
    image: "/profiles/profile-3.jpg",
    distance: "3 stops away",
  },
  {
    id: 4,
    name: "Marcus",
    age: 29,
    neighborhood: "Bushwick",
    line: "M",
    stop: "Myrtle-Wyckoff",
    bio: "Freelance writer and amateur chef. I've been to every dollar slice spot in Brooklyn and I have strong opinions about which one's the best.",
    interests: ["Writing", "Pizza", "Live Music", "Basketball"],
    image: "/profiles/profile-4.jpg",
    distance: "4 stops away",
  },
  {
    id: 5,
    name: "Elena",
    age: 30,
    neighborhood: "Park Slope",
    line: "F",
    stop: "7th Ave",
    bio: "Book editor who runs half marathons for fun. Always reading on the train. Bonus points if you can recommend a good bookstore I haven't been to yet.",
    interests: ["Running", "Books", "Wine", "Hiking"],
    image: "/profiles/profile-5.jpg",
    distance: "6 stops away",
  },
]
