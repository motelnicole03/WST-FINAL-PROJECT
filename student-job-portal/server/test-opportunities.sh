#!/usr/bin/env bash
# Walks through the whole opportunities flow against a running server (npm run dev).
# Usage: bash test-opportunities.sh
BASE=${BASE:-http://localhost:4000/api}

json() { node -pe "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); $1"; }
show() { json 'JSON.stringify(d,null,2)'; }
api() { # api METHOD PATH [TOKEN] [JSON_BODY]
  local args=(-s -X "$1" "$BASE$2" -H "Content-Type: application/json")
  [ -n "$3" ] && args+=(-H "Authorization: Bearer $3")
  [ -n "$4" ] && args+=(-d "$4")
  curl "${args[@]}"
}

export EMAIL="hr$(date +%s)@acme.test"

echo "1. Log in as admin"
ADMIN=$(api POST /auth/login "" '{"email":"admin@school.edu","password":"ChangeMe123!"}' | json 'd.token')
[ -z "$ADMIN" ] || [ "$ADMIN" = "undefined" ] && { echo "Admin login failed. Check ADMIN_PASSWORD in .env"; exit 1; }

echo "2. Register an employer ($EMAIL)"
EMP=$(api POST /auth/register "" "{\"role\":\"employer\",\"email\":\"$EMAIL\",\"password\":\"password123\",\"companyName\":\"Acme Software\",\"industry\":\"Technology\"}" | json 'd.token')

echo "3. Unverified employer tries to post (should be refused)"
api POST /opportunities "$EMP" '{"type":"internship","title":"Should fail"}' | show

echo "4. Admin verifies the employer"
EID=$(api GET "/admin/employers?status=pending" "$ADMIN" | json 'd.find(e => e.email === process.env.EMAIL).employerId')
api POST "/admin/employers/$EID/verify" "$ADMIN" | show

echo "5. Employer creates an internship (starts as a draft)"
OID=$(api POST /opportunities "$EMP" '{
  "type":"internship","title":"Web Developer Intern",
  "description":"Build features for our student portal.","requirements":"Basic JavaScript",
  "location":"Makati City","workSetup":"hybrid","allowanceSalary":5000,"slots":2,
  "deadline":"2027-12-31T00:00:00Z","programId":1,"skillIds":[1,2]}' | json 'd.opportunityId')
echo "   created opportunity $OID"

echo "6. It is not public yet (list should be empty or unchanged)"
api GET "/opportunities?q=Web%20Developer" "" | json 'd.pagination.total'

echo "7. Employer submits it, admin approves it"
api POST "/opportunities/$OID/submit" "$EMP" | json 'd.status'
api POST "/opportunities/$OID/approve" "$ADMIN" | json 'd.status'

echo "8. Public search now finds it"
api GET "/opportunities?q=Web%20Developer&type=internship&workSetup=hybrid" "" | show

echo "9. Student saves it, then lists saved"
STU=$(api POST /auth/login "" '{"email":"ana@school.edu","password":"password123"}' | json 'd.token')
api POST "/opportunities/$OID/save" "$STU"; echo "   saved"
api GET /opportunities/saved "$STU" | json 'd.map(o => o.title)'

echo "10. Employer closes it"
api POST "/opportunities/$OID/close" "$EMP" | json 'd.status'
