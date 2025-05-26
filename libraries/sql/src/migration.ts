import { AddMigration } from '.';

AddMigration({
  id: '10f9f3e4-ba79-4bf9-a540-9a2d235d00d6',
  name: 'add_updated_at_trigger',
  dependencies: [],
  statement: `
    CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS trigger
        LANGUAGE plpgsql
        AS 
    $function$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
    $function$;
    
    `,
});
