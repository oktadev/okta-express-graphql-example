require('dotenv').config({ path: '.env' })

const express = require('express')
const cors = require('cors')
const graphqlHTTP = require('express-graphql')
const gql = require('graphql-tag')
const { buildASTSchema } = require('graphql')
const uuid = require('uuid')

const okta = require('./okta')

const app = express()
app.use(cors())
okta.initializeApp(app)

const schema = buildASTSchema(gql`
  # Queries

  type Query {
    posts: [Post]
    post(id: ID): Post
    authors: [Person]
    author(id: ID): Person
  }

  type Post {
    id: ID
    author: Person
    body: String
  }

  type Person {
    id: ID
    posts: [Post]
    firstName: String
    lastName: String
  }

  # Mutations
  type Mutation {
    submitPost(input: PostInput!): Post
    deletePost(id: ID!): Boolean
  }

  input PostInput {
    id: ID
    body: String!
  }
`)

const PEOPLE = new Map()
const POSTS = new Map()

class Post {
  constructor (data) { Object.assign(this, data) }
  get author () {
    return PEOPLE.get(this.authorId)
  }
}

class Person {
  constructor (data) { Object.assign(this, data) }
  get posts () {
    return [...POSTS.values()].filter(post => post.authorId === this.id)
  }
}

const getUserId = async ({ authorization }) => {
  try {
    const accessToken = authorization.trim().split(' ')[1]
    const { claims: { uid } } = await okta.verifier.verifyAccessToken(accessToken)

    return uid
  } catch (error) {
    return null
  }
}

const saveUser = async (id) => {
  try {
    if (!PEOPLE.has(id)) {
      const { profile: { firstName, lastName } } = await okta.client.getUser(id)

      PEOPLE.set(id, new Person({ id, firstName, lastName }))
    }
  } catch (ignore) { }

  return PEOPLE.get(id)
}

const rootValue = {
  // Queries
  posts: () => POSTS.values(),
  post: ({ id }) => POSTS.get(id),
  authors: () => PEOPLE.values(),
  author: ({ id }) => PEOPLE.get(id),

  // Mutations
  submitPost: async ({ input }, { headers }) => {
    const authorId = await getUserId(headers)
    if (!authorId) return null

    const { id = uuid(), body } = input

    if (POSTS.has(id) && POSTS.get(id).authorId !== authorId) return null
    await saveUser(authorId)

    POSTS.set(id, new Post({ id, authorId, body }))

    return POSTS.get(id)
  },
  deletePost: async ({ id }, { headers }) => {
    if (!POSTS.has(id)) return false

    const userId = await getUserId(headers)
    if (POSTS.get(id).authorId !== userId) return false

    POSTS.delete(id)

    if (PEOPLE.get(userId).posts.length === 0) {
      PEOPLE.delete(userId)
    }

    return true
  }
}

app.use('/graphql', graphqlHTTP({ schema, rootValue }))

const port = process.env.PORT || 4000
app.listen(port)
console.log(`Running a GraphQL API server at localhost:${port}/graphql`)
