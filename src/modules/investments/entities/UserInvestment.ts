import { UserInvestment } from "@prisma/client";

class UserInvestmentEntity {
  
  id!: UserInvestment["id"]

  userID!: UserInvestment["userID"]

  investmentID!: UserInvestment["investmentID"]
  
  investedValue!: UserInvestment["investedValue"]
  valorCorrente!: UserInvestment["valorCorrente"]
  documents!: UserInvestment["documents"]
  dataInvestimento!: UserInvestment["dataInvestimento"]


  createdAt!: UserInvestment["createdAt"]
  updatedAt!: UserInvestment["updatedAt"]

}

export { UserInvestmentEntity }