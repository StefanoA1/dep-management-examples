## Hello!

This is a mini repo containing a small Typescript adaptation of my own of this article:
`https://fsharpforfunandprofit.com/posts/dependencies-5/`

The article contains code originally written in haskell, the comments are in french due to 
my target audience for this repo, the article is in English and basically my
repo is a pros and cons lite version of the article with my own more subjective than objective
ideas over it.

## Use case:
Let’s look at a concrete use-case that we can use as a basis to experiment with different implementations.

Say that we have some kind of web app with users, and each user has a “profile” with their name, email, preferences, etc. A use-case for updating their profile might be something like this:

Receive a new profile (parsed from a JSON request, say)
Read the user’s current profile from the database
If the profile has changed, update the user’s profile in the database
If the email has changed, send a verification email message to the user’s new email
Add a little bit of logging into the mix

Keywords: Deterministic code, pure code.
