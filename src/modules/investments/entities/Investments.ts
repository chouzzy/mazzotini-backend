import { Investment } from "@prisma/client";

class InvestmentEntity {
  id!: Investment["id"];
  title!: Investment["title"];
  description!: Investment["description"];
  projectType!: Investment["projectType"];
  totalUnits!: Investment["totalUnits"];
  numberOfFloors!: Investment["numberOfFloors"];
  unitsPerFloor!: Investment["unitsPerFloor"];
  floorPlanTypes!: Investment["floorPlanTypes"];
  launchDate!: Investment["launchDate"];
  constructionStartDate!: Investment["constructionStartDate"];
  expectedDeliveryDate!: Investment["expectedDeliveryDate"];
  address!: Investment["address"];
  documents!: Investment["documents"];
  images!: Investment["images"];
  investmentValue!: Investment["investmentValue"];
  companyName!: Investment["companyName"];
  partners!: Investment["partners"];
  finishDate?: Investment["finishDate"];
  buildingStatus!: Investment["buildingStatus"];
  investmentDate!: Investment["investmentDate"];
  predictedCost!: Investment["predictedCost"];
  realizedCost!: Investment["realizedCost"];
  projectManagerID!: Investment["projectManagerID"]
  buildingProgress!: Investment["buildingProgress"]
  active!: Investment["active"]

  valorOriginal!: Investment["valorOriginal"]
  valorCorrente!: Investment["valorCorrente"]
  historicoDeValorizacao!: Investment["historicoDeValorizacao"]

  createdAt!: Investment["createdAt"];
  updatedAt?: Investment["updatedAt"];
}

export { InvestmentEntity };