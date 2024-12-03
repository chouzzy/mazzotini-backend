
import { Users } from "@prisma/client";

class UsersEntity {
  id!: Users["id"];
  name!: Users["name"];
  email!: Users["email"];
  phoneNumber!: Users["phoneNumber"];
  gender!: Users["gender"];
  profession!: Users["profession"];
  birth!: Users["birth"];
  cpf!: Users["cpf"];
  username!: Users["username"];
  address!: Users["address"];
  investorProfileName!: Users["investorProfileName"];
  investorProfileDescription!: Users["investorProfileDescription"];
  userNotifications!: Users["userNotifications"];
  role!: Users["role"]; 
  createdAt!: Users["createdAt"];
  updatedAt?: Users["updatedAt"];

}

export { UsersEntity };

