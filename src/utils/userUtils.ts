import { UsersEntity } from "../modules/registrations/entities/Users"
import { CreateUsersRequestProps } from "../modules/registrations/useCases/Users/createUsers/CreateUsersController"
import { ListResumedUsersProps } from "../modules/registrations/useCases/Users/listResumedUsers/ListResumedUsersUseCase"
import { FilterUsersRequestProps } from "../modules/registrations/useCases/Users/listUsers/ListUsersController"
import { FilterUsersProps } from "../modules/registrations/useCases/Users/listUsers/ListUsersUseCase"
import { UpdateUsersRequestProps } from "../modules/registrations/useCases/Users/updateUsers/UpdateUsersController"
import axios from 'axios';
import { prisma } from "../prisma"


async function getPrismaUsersByID(id: UsersEntity["id"]) {

    try {

        const searchedUser = await prisma.users.findUnique({
            where: { id },
        })

        return searchedUser

    } catch (error) {
        throw error
    }

}
async function getPrismaUsers(usersData: CreateUsersRequestProps) {

    try {

        const searchedUsers = await prisma.users.findMany({
            where: {
                OR: [
                    { username: usersData.username },
                ],
            },
        })

        return searchedUsers

    } catch (error) {
        throw error
    }

}

async function createPrismaUser(usersData: CreateUsersRequestProps) {

    try {

        const existingUserByEmail = await prisma.users.findUnique({ where: { email: usersData.email } });
        if (existingUserByEmail) {
            throw new Error('O Email já existe.');
        }

        const existingUserByCpf = await prisma.users.findUnique({ where: { cpf: usersData.cpf } });
        if (existingUserByCpf) {
            throw new Error('O CPF já existe.');
        }

        const existingUserByUsername = await prisma.users.findUnique({ where: { username: usersData.username } });
        if (existingUserByUsername) {
            throw new Error('O Username já existe.');
        }
        const { birth } = usersData
        
        if (birth) {
            usersData.birth = new Date(birth)
        }

        const createUsers = await prisma.users.create({
            data: usersData
        })

        return createUsers

    } catch (error) {
        throw error
    }

}

async function validatePageParams(filterUserData: FilterUsersRequestProps) {

    try {
        const { page, pageRange } = filterUserData;

        const pageInt = Number(page) || 1;
        const pageRangeInt = Number(pageRange) || 10;

        if (!Number.isInteger(pageInt) || pageInt <= 0) {
            throw new Error('Invalid page number');
        }

        if (!Number.isInteger(pageRangeInt) || pageRangeInt <= 0) {
            throw new Error('Invalid page range');
        }

        return {
            page: pageInt,
            pageRange: pageRangeInt,
        };
    } catch (error) {
        throw error;
    }
}

async function filterPrismaUser(listUserFormatted: FilterUsersProps) {

    try {

        const {
            id,
            name,
            email,
            cpf,
            username,
            page,
            pageRange
        } = listUserFormatted

        const filteredUsers = await prisma.users.findMany({
            where: {
                AND: [
                    { id },
                    { name },
                    { email },
                    { cpf },
                    { username }
                ]
            },
            skip: (page - 1) * pageRange,
            take: pageRange,
        })

        return filteredUsers

    } catch (error) {
        throw error
    }

}

async function filterResumedPrismaUser(listUserFormatted: ListResumedUsersProps) {

    try {

        const {
            id,
            name,
            email,
            role,
            page,
            pageRange
        } = listUserFormatted

        // Fix this for me, select is not working:
        const filteredUsers = await prisma.users.findMany({
            where: {
                AND: [
                    { id },
                    { name },
                    { email },
                    { role }
                ]
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                investorProfileName:true
            },
            skip: (page - 1) * pageRange,
            take: pageRange,
        })

        return filteredUsers

    } catch (error) {
        throw error
    }

}


async function updatePrismaUser(usersData: UpdateUsersRequestProps, id: UsersEntity["id"]) {

    try {

        const user = await getPrismaUsersByID(id)

        if (!user) {
            throw Error("Usuário não encontrado.")
        }

        const updatedUser = await prisma.users.update({
            where: { id },
            data: {
                name: usersData.name ?? user.name,
                email: usersData.email ?? user.email,
                phoneNumber: usersData.phoneNumber ?? user.phoneNumber,
                gender: usersData.gender ?? user.gender,
                profession: usersData.profession ?? user.profession,
                birth: usersData.birth ?? user.birth,
                username: usersData.username ?? user.username,
                address: usersData.address ?? user.address,
                investorProfileName: usersData.investorProfileName ?? user.investorProfileName,
                investorProfileDescription: usersData.investorProfileDescription ?? user.investorProfileDescription,
                userNotifications: usersData.userNotifications ?? user.userNotifications 
            },
        });

        return updatedUser

    } catch (error) {
        throw error
    }
}

async function deletePrismaUser(id: UsersEntity["id"]) {

    try {

        const deletedUser = await prisma.users.delete({
            where: { id }
        })

        return deletedUser

    } catch (error) {
        throw error
    }
}

async function deleteAuth0User(auth0UserID: string, accessToken: string) {

    try {
        console.log('vamos deletar auth0')

        const options = {
            method: 'delete',
            maxBodyLength: Infinity,
            url: `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/users/${auth0UserID}`,
            headers: { Authorization: `Bearer ${process.env.AUTH0_MANAGEMENTAPI_TOKEN}`, }
        };

        const response = await axios.request(options)

        console.log('vamos deletar auth0')

        console.log(response)
        // if (response.status === 204) {

        // }


    } catch (error) {
        console.log(error)
        throw error
    }
}


export { getPrismaUsers, createPrismaUser, validatePageParams, filterPrismaUser, updatePrismaUser, deletePrismaUser, deleteAuth0User, filterResumedPrismaUser }