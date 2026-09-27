# Cocktail Flow

A static cocktail website inspired by [cocktailflow.com](https://cocktailflow.com/). There's no build step. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server -d cocktail-flow 8000
```

## Features

- **Browse**: about 100 recipes, grouped the same way cocktailflow.com groups them: base spirit, type, strength and colour, plus themed collections. You can also search by cocktail name or ingredient. Click a card to see the full recipe.
- **My Bar**: tick the ingredients you have. You'll see what you can make now and which cocktails need just one more ingredient.
- **Shopping Suggestions**: based on your bar, you get three kinds of suggestions:
  - ⚡ **Quick Wins**: single items that unlock the most new cocktails on their own.
  - 🛒 **Best Value Bundle**: three items that together unlock the most cocktails.
  - 🧭 **New Direction**: three items that open up a spirit family you don't own yet.

Your ingredient selection is saved in `localStorage`.

## Files

- `index.html`: the page layout
- `styles.css`: the styling
- `app.js`: the logic for browsing, My Bar and shopping suggestions
- `data.js`: the ingredients, categories and recipes. To add a recipe, append it to `COCKTAILS`. Its ingredient names must match `INGREDIENT_GROUPS`.
