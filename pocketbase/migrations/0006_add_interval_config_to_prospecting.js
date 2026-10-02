/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Add min_interval_seconds and max_interval_seconds to prospect_lists if not present
    const prospectLists = app.findCollectionByNameOrId('prospect_lists')
    if (!prospectLists.fields.getByName('min_interval_seconds')) {
      prospectLists.fields.add(
        new NumberField({
          name: 'min_interval_seconds',
          min: 5,
        }),
      )
    }
    if (!prospectLists.fields.getByName('max_interval_seconds')) {
      prospectLists.fields.add(
        new NumberField({
          name: 'max_interval_seconds',
          min: 5,
        }),
      )
    }
    app.save(prospectLists)

    // 2. Ensure existing records in broadcast_campaigns and prospect_lists are filled with defaults (20 / 45)
    app
      .db()
      .newQuery(`
      UPDATE broadcast_campaigns
      SET min_interval_seconds = 20
      WHERE min_interval_seconds IS NULL OR min_interval_seconds < 5
    `)
      .execute()

    app
      .db()
      .newQuery(`
      UPDATE broadcast_campaigns
      SET max_interval_seconds = 45
      WHERE max_interval_seconds IS NULL OR max_interval_seconds < 20
    `)
      .execute()

    app
      .db()
      .newQuery(`
      UPDATE prospect_lists
      SET min_interval_seconds = 20
      WHERE min_interval_seconds IS NULL OR min_interval_seconds < 5
    `)
      .execute()

    app
      .db()
      .newQuery(`
      UPDATE prospect_lists
      SET max_interval_seconds = 45
      WHERE max_interval_seconds IS NULL OR max_interval_seconds < 20
    `)
      .execute()
  },
  (app) => {
    try {
      const prospectLists = app.findCollectionByNameOrId('prospect_lists')
      const minF = prospectLists.fields.getByName('min_interval_seconds')
      if (minF) prospectLists.fields.removeByName('min_interval_seconds')
      const maxF = prospectLists.fields.getByName('max_interval_seconds')
      if (maxF) prospectLists.fields.removeByName('max_interval_seconds')
      app.save(prospectLists)
    } catch (_) {}
  },
)
