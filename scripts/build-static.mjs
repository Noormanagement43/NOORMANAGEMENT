// Package browser assets only. Never publish the checkout, SQL, tests or archives.
import { readdir, mkdir, copyFile, rm, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
export async function build(root, output) {
  root=resolve(root);output=resolve(output);
  if(output!==join(root,'dist'))throw Error('Build output must be the repository dist directory');
  await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
  async function copy(dir,relative=''){
    for(const e of await readdir(dir,{withFileTypes:true})){
      if(e.isSymbolicLink())throw Error('Symlinks cannot be deployed');
      const rel=join(relative,e.name),src=join(dir,e.name),dest=join(output,rel);
      if(e.isDirectory()){
        if(!relative&&!['assets','sounds'].includes(e.name))continue;
        await copy(src,rel);
      }else if(e.isFile()&&e.name!=='create-noor-zip.js'&&(/\.(?:html|css|js|svg|png|jpe?g|webp|ico|woff2?|mp3|ogg|wav|webmanifest)$/i.test(e.name)||(!relative&&e.name==='.nojekyll'))){
        await mkdir(resolve(dest,'..'),{recursive:true});await copyFile(src,dest);
      }
    }
  }
  await copy(root);await stat(join(output,'index.html'));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await build(process.cwd(),join(process.cwd(),'dist'));
