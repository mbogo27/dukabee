# Supplier sheets (raw, never edited)

Drop each stock sheet from Francis here as `laptop_stock_YYYY-MM-DD.xlsx`, then:

```
npm run import:dobatron -- data/dobatron/source/laptop_stock_YYYY-MM-DD.xlsx
npm run build:dobatron
```

The importer reads the first sheet (or `--sheet "Stock List"`) with columns `Brand | Model | Specifications | Price (KES)`.
If a row's model isn't in `../models.json` `sheetAliases`, the run fails and lists the row numbers: add the alias
(or a new model) and run it again. Nothing here is ever published.

Put the original `laptop_stock_no_markup.xlsx` here too: the importer snapshot test (`npm test`) prefers it over the
reconstructed fixture.
