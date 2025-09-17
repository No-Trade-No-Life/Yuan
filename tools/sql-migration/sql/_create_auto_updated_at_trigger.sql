CREATE
OR REPLACE FUNCTION update_updated_at_column () RETURNS TRIGGER LANGUAGE plpgsql AS $function$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
    $function$;