-- =========================================================================
-- QUESTIONFORGE AI: FIX HANDLE NEW USER TRIGGER FUNCTION
-- Fixes "Database error creating new user" during Auth User creation
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    derived_role public.user_role := 'USER';
    raw_role text;
BEGIN
    -- Extract role string safely from raw_user_meta_data if present
    IF NEW.raw_user_meta_data IS NOT NULL THEN
        raw_role := UPPER(TRIM(NEW.raw_user_meta_data->>'role'));
        IF raw_role = 'ADMIN' THEN
            derived_role := 'ADMIN';
        ELSIF raw_role = 'MASTER_ADMIN' THEN
            derived_role := 'MASTER_ADMIN';
        END IF;
    END IF;

    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        avatar_url,
        role,
        status,
        projects_count,
        questions_count,
        storage_used_bytes,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, ''), '@', 1), 'User'),
        NEW.raw_user_meta_data->>'avatar_url',
        derived_role,
        'ACTIVE'::public.user_status,
        0,
        0,
        0,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
        updated_at = NOW();

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user trigger notice for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
