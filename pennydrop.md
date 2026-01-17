# Curl command for initialize penny drop api from surepass: 

## (Request) curl command

curl --location --request POST 'https://kyc-api.surepass.io/api/v1/bank-verification/reverse-penny-drop/initialize' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer TOKEN'

## (Response) json for the above command

{
  "data": {
    "client_id": "reverse_penny_drop_YnaoOsFcdMxQxbvOBlqr",
    "payment_link": "upi://pay?pa=SUREPASS@dbs&pn=&am=1&cu=INR&tn=&tr=CHE00041220",
    "ios_links": {
      "paytm": "paytm://upi/pay?pa=SUREPASS@dbs&pn=&am=1&cu=INR&tn=&tr=CHE00041220",
      "phonepe": "phonepe://upi/pay?pa=SUREPASS@dbs&pn=&am=1&cu=INR&tn=&tr=CHE00041220",
      "gpay": "gpay://upi/pay?pa=SUREPASS@dbs&pn=&am=1&cu=INR&tn=&tr=CHE00041220",
      "bhim": "bhim://upi/pay?pa=SUREPASS@dbs&pn=&am=1&cu=INR&tn=&tr=CHE00041220",
      "whatsapp": "upi://pay?pa=SUREPASS@dbs&pn=&am=1&cu=INR&tn=&tr=CHE00041220"
    }
  },
  "status_code": 200,
  "success": true,
  "message": "Success",
  "message_code": "success"
}

--- 

# Curl command for checking status of penny drop created

## (Request) Curl command

curl --location 'https://kyc-api.surepass.io/api/v1/bank-verification/reverse-penny-drop/status' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer TOKEN' \
--data '{
    "client_id": "reverse_penny_drop_prtkdSoSybrlmvZkzfCi"
}'

## (Response) json for the above command:

{
  "data": {
    "client_id": "reverse_penny_drop_prtkdSoSybrlmvZkzfCi",
    "details": {
      "account_number": "77780101256547",
      "ifsc": "UBIN0123546",
      "upi_id": "test@ybl",
      "amount": "1",
      "payment_mode": "UPI",
      "holder_name": "TEST GUPTA",
      "type": "credit",
      "remitter_name": "TEST GUPTA",
      "status": "success"
    }
  },
  "status_code": 200,
  "success": true,
  "message": "Success",
  "message_code": "success"
}

---

# You need to write this properly in deno supabase edge functions. and in secrets i will manually add the token in supabase secrets from the dashboard. 