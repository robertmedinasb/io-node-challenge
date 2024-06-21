# Reto técnico iO - Backend

## Descripción:
Se requiere implementar un proyecto serverless de registro de pagos y consulta de transacciones. A continuación se muestran los diagramas correspondientes:

### Diagrama 1:
![Diagrama 1](images/post.png)
Este API debe de llamar a un Step Function el cual debe:
- Validar el id de usuario comparándolo en la tabla **users**
- En caso el usuario exista, un lambda llamado **execute-payments** debe llamar a un API Mock que el postulante debe crear, el cual debe de regresar una transacción exitosa
- Si la transacción es exitosa, debe de grabarse un registro en la tabla **transactions**
- Al terminar todo de forma exitosa, debe dar una respuesta satisfactoria que contenga el id de la transacción

Nota: En el momento que se interactúa con la tabla **transactions**, un stream de DynamoDB debe activar el lambda **register-activity**, el cual debe de guardar un registro del suceso en la tabla **activity**

### Diagrama 2:
![Diagrama 2](images/get.png)
Este API debe de llamar a un Lambda Function la cual debe:
- Consultar por el id de transacción desde el lambda **get-transaction** en la tabla **transactions**
- En caso la transacción exista, debe de regresar el registro de la transacción
- En caso la transacción no exista, debe de regresar una respuesta con el mensaje "Usuario no encontrado"

## Consideraciones:

Obligatorio : 
1. Respetar el arquetipo 
2. Construir pruebas unitarias
3. Buenas Prácticas (SOLID, Clean Code, etc)

Deseable: 
1. Crear los componentes con IaC (Terraform, Cloudformation)
2. Logs usando CloudWatch
3. Formatters / Linters

## Anexos:

### POST /v1/payments

Payload
```json
{
    "userId": "f529177d-0521-414e-acd9-6ac840549e97",
    "amount": 30
}
```

Respusta OK (201)
```json
{
    "message": "Payment registered successfully",
    "transactionId": "8db0a6fc-ad42-4974-ac1f-36bb90730afe"
}
```

Respuesta errada (400)
```json
{
    "message": "Something was wrong"
}
```

### GET /v1/transactions

Query params
```
transactionId: "8db0a6fc-ad42-4974-ac1f-36bb90730afe"
```

Respusta OK (200)
```json
{
    "transactionId": "8db0a6fc-ad42-4974-ac1f-36bb90730afe",
    "userId": "f529177d-0521-414e-acd9-6ac840549e97",
    "paymentAmount": 30
}
```

Respuesta errada (404)
```json
{
    "message": "Transaction not found"
}
```

### Tabla users:

La tabla users debe de contener datos de los usuarios que pueden realizar una transacción.

<dl>
    <dt>Esquema:</dt>
    <dd>userId (string - partition key)</dd>
    <dd>name (string)</dd>
    <dd>lastName (string)</dd>
</dl>

La tabla debe de tener el siguiente contenido:
| userId      | name | lastName |
| ----------- | ----------- | ----------- |
| f529177d-0521-414e-acd9-6ac840549e97      | Pedro       | Suarez       |
| 15f1c60a-2833-49b7-8660-065b58be2f89   | Andrea        | Vargas        |

### Tabla transactions:

<dl>
    <dt>Esquema:</dt>
    <dd>transactionId (partition key)</dd>
    <dd>userId</dd>
    <dd>amount</dd>
</dl>

### Tabla activity:

<dl>
    <dt>Esquema:</dt>
    <dd>activityId (partition key)</dd>
    <dd>transactionId</dd>
    <dd>date</dd>
</dl>

## Send us your challenge
Cuando termines el reto, luego de forkear el repositorio, debes crear un pull request to our repository indicando en la descripción de este tu nombre y correo.

### Tiempo de resolución: 3 días