import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function setPassword() {
  const sql = neon(process.env.DATABASE_URL!);

  const password = 'Admin2026!';
  const hash = await bcrypt.hash(password, 12);

  const result = await sql`
    UPDATE users
    SET password = ${hash}
    WHERE email = 'settouti.hamza@gmail.com'
    RETURNING email
  `;

  console.log('Password set for:', result[0]?.email);
}

setPassword();
