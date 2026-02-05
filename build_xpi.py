import zipfile
import os

def create_xpi():
    current_dir = os.getcwd()
    output_filename = 'smartproxy.xpi'
    
    # Files/Dirs to exclude
    excludes = {
        '.git', 
        '.gitignore', 
        'build_xpi.py', 
        'smartproxy.zip', 
        'smartproxy.xpi' # Exclude the target itself if it exists
    }

    try:
        with zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, files in os.walk(current_dir):
                # Filter out excluded directories in-place
                dirs[:] = [d for d in dirs if d not in excludes]
                
                for file in files:
                    if file in excludes or file.endswith('.xpi') or file.endswith('.zip'):
                        continue
                        
                    abs_path = os.path.join(root, file)
                    rel_path = os.path.relpath(abs_path, current_dir)
                    
                    # FORCE forward slashes for ZIP compatibility
                    arcname = rel_path.replace(os.sep, '/')
                    
                    print(f"Adding: {arcname}")
                    zf.write(abs_path, arcname)
        print(f"Successfully created {output_filename}")
    except Exception as e:
        print(f"Error creating XPI: {e}")

if __name__ == '__main__':
    create_xpi()
