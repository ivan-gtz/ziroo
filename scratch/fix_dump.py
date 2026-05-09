import re

def fix_sql_dump(input_file, output_file):
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Split the file by the standard pg_dump separator for objects
    # It usually looks like:
    # --
    # -- Name: calculate_distance_km; Type: FUNCTION; Schema: public; Owner: -
    # --
    
    # We will find all chunks using a regex that matches the header block
    # or we can just split by "\n--\n-- Name: "
    
    chunks = content.split('\n--\n-- Name: ')
    
    preamble = chunks[0]
    
    kept_chunks = [preamble]
    
    for chunk in chunks[1:]:
        # chunk starts with the name, e.g. "auth; Type: SCHEMA; Schema: -; Owner: -\n--\n"
        header_line = chunk.split('\n')[0]
        
        # We only want to keep chunks where Schema is 'public'
        # because Supabase already pre-creates 'auth', 'storage', 'realtime', etc. in new projects.
        if 'Schema: public' in header_line:
            kept_chunks.append('\n--\n-- Name: ' + chunk)
            
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("".join(kept_chunks))
        
    print(f"✅ Filtered SQL dump! Kept {len(kept_chunks)-1} public objects out of {len(chunks)-1} total objects.")

if __name__ == '__main__':
    fix_sql_dump('postgres.dump', 'ziroo_public_schema.sql')
